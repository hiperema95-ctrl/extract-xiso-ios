#include "XISOBridge.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <errno.h>

#define XDVDFS_SECTOR_SIZE 2048ULL
#define XDVDFS_VD_SECTOR 32ULL
#define XDVDFS_VD_OFFSET (XDVDFS_VD_SECTOR * XDVDFS_SECTOR_SIZE)
#define XDVDFS_MAGIC "MICROSOFT*XBOX*MEDIA"
#define XDVDFS_ATTR_DIR 0x10

/* All known Xbox & Xbox 360 game partition base offsets */
static const uint64_t KNOWN_OFFSETS[] = {
    0x00000000ULL, /* Standard Trimmed XISO */
    0x0FD90000ULL, /* Xbox 360 XGD2 Redump / Raw DVD9 (7.83 GB) */
    0x02080000ULL, /* Xbox 360 XGD3 Redump / Raw */
    0x18300000ULL, /* Original Xbox XGD1 Redump / Raw */
    0x06060000ULL, /* Xbox 360 XGD2 Wave 1/2 */
    0x02060000ULL, /* Xbox 360 XGD3 Alt */
    0x0FDA0000ULL, /* Direct VD fallback XGD2 */
    0x18310000ULL, /* Direct VD fallback XGD1 */
    0x02090000ULL  /* Direct VD fallback XGD3 */
};

static uint16_t read_le16(const uint8_t *p) {
    return (uint16_t)p[0] | ((uint16_t)p[1] << 8);
}

static uint32_t read_le32(const uint8_t *p) {
    return (uint32_t)p[0] | ((uint32_t)p[1] << 8) | ((uint32_t)p[2] << 16) | ((uint32_t)p[3] << 24);
}

static uint32_t read_be32(const uint8_t *p) {
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) | ((uint32_t)p[2] << 8) | (uint32_t)p[3];
}

static void write_le32(uint8_t *p, uint32_t v) {
    p[0] = (uint8_t)(v & 0xFF);
    p[1] = (uint8_t)((v >> 8) & 0xFF);
    p[2] = (uint8_t)((v >> 16) & 0xFF);
    p[3] = (uint8_t)((v >> 24) & 0xFF);
}

static int verify_vd_sector(const uint8_t *sector) {
    if (memcmp(sector, XDVDFS_MAGIC, 20) != 0) return 0;
    if (memcmp(sector + 0x7EC, XDVDFS_MAGIC, 20) != 0) return 0;
    return 1;
}

static void mkdir_recursive(const char *dir_path) {
    char tmp[1024];
    snprintf(tmp, sizeof(tmp), "%s", dir_path);
    size_t len = strlen(tmp);
    if (len == 0) return;
    if (tmp[len - 1] == '/') tmp[len - 1] = '\0';
    for (char *p = tmp + 1; *p; p++) {
        if (*p == '/') {
            *p = '\0';
            mkdir(tmp, 0755);
            *p = '/';
        }
    }
    mkdir(tmp, 0755);
}

static void patch_xbe_header_if_needed(uint8_t *buf, size_t len) {
    if (len < 0x200) return;
    if (memcmp(buf, "XBEH", 4) != 0) return;
    uint32_t base_addr = read_le32(buf + 0x104);
    uint32_t cert_addr = read_le32(buf + 0x118);
    if (cert_addr < base_addr) return;
    uint32_t cert_offset = cert_addr - base_addr;
    if (cert_offset + 0xA4 > len) return;

    uint32_t media_flags = read_le32(buf + cert_offset + 0x9C);
    write_le32(buf + cert_offset + 0x9C, media_flags | 0x00FFFFFFU);

    uint32_t region_flags = read_le32(buf + cert_offset + 0xA0);
    write_le32(buf + cert_offset + 0xA0, region_flags | 0x80000007U);
}

static void parse_exec_metadata(FILE *fp, uint64_t part_offset, uint32_t start_sector, uint32_t size_bytes, xiso_volume_info_t *info) {
    if (size_bytes < 0x100) return;
    uint8_t buf[16384];
    size_t to_read = size_bytes < sizeof(buf) ? size_bytes : sizeof(buf);
    if (fseeko(fp, (off_t)(part_offset + (uint64_t)start_sector * XDVDFS_SECTOR_SIZE), SEEK_SET) != 0) return;
    if (fread(buf, 1, to_read, fp) != to_read) return;

    /* Original Xbox .xbe */
    if (memcmp(buf, "XBEH", 4) == 0 && to_read >= 0x200) {
        uint32_t base_addr = read_le32(buf + 0x104);
        uint32_t cert_addr = read_le32(buf + 0x118);
        if (cert_addr < base_addr) return;
        uint32_t cert_offset = cert_addr - base_addr;
        if (cert_offset + 0xB0 > to_read) return;

        uint32_t title_id = read_le32(buf + cert_offset + 0x08);
        snprintf(info->title_id, sizeof(info->title_id), "%08X", title_id);

        char title_utf8[64];
        int out_idx = 0;
        for (int i = 0; i < 40 && out_idx < (int)sizeof(title_utf8) - 1; i++) {
            uint16_t ch = read_le16(buf + cert_offset + 0x0C + i * 2);
            if (ch == 0) break;
            if (ch < 128) {
                title_utf8[out_idx++] = (char)ch;
            }
        }
        title_utf8[out_idx] = '\0';
        if (out_idx > 0) {
            snprintf(info->title_name, sizeof(info->title_name), "%s", title_utf8);
        }
        return;
    }

    /* Xbox 360 .xex (XEX2) */
    if (memcmp(buf, "XEX2", 4) == 0 && to_read >= 24) {
        snprintf(info->title_id, sizeof(info->title_id), "XBOX360");
        uint32_t header_count = read_be32(buf + 0x14);
        if (24 + header_count * 8 <= to_read) {
            for (uint32_t i = 0; i < header_count; i++) {
                uint32_t key = read_be32(buf + 24 + i * 8);
                uint32_t val_offset = read_be32(buf + 24 + i * 8 + 4);
                if (key == 0x00040006U && val_offset + 16 <= to_read) {
                    uint32_t tid = read_be32(buf + val_offset + 12);
                    if (tid != 0) {
                        snprintf(info->title_id, sizeof(info->title_id), "%08X", tid);
                    }
                    break;
                }
            }
        }
    }
}

static int find_partition_offset(FILE *fp, uint64_t *out_offset, uint8_t *out_vd) {
    /* 1. Check known Xbox & Xbox 360 partition base offsets */
    for (size_t i = 0; i < sizeof(KNOWN_OFFSETS) / sizeof(KNOWN_OFFSETS[0]); i++) {
        uint64_t candidate = KNOWN_OFFSETS[i];
        if (fseeko(fp, (off_t)(candidate + XDVDFS_VD_OFFSET), SEEK_SET) == 0) {
            if (fread(out_vd, 1, XDVDFS_SECTOR_SIZE, fp) == XDVDFS_SECTOR_SIZE) {
                if (verify_vd_sector(out_vd)) {
                    *out_offset = candidate;
                    return 0;
                }
            }
        }
        /* Check if candidate itself is the VD offset */
        if (candidate >= XDVDFS_VD_OFFSET && fseeko(fp, (off_t)candidate, SEEK_SET) == 0) {
            if (fread(out_vd, 1, XDVDFS_SECTOR_SIZE, fp) == XDVDFS_SECTOR_SIZE) {
                if (verify_vd_sector(out_vd)) {
                    *out_offset = candidate - XDVDFS_VD_OFFSET;
                    return 0;
                }
            }
        }
    }

    /* 2. Fast 64KB step scan across first 600 MB of image */
    uint64_t max_scan = 600ULL * 1024ULL * 1024ULL;
    for (uint64_t pos = XDVDFS_VD_OFFSET; pos < max_scan; pos += 0x10000ULL) {
        if (fseeko(fp, (off_t)pos, SEEK_SET) != 0) break;
        if (fread(out_vd, 1, XDVDFS_SECTOR_SIZE, fp) != XDVDFS_SECTOR_SIZE) break;
        if (out_vd[0] == 'M' && out_vd[1] == 'I' && verify_vd_sector(out_vd)) {
            *out_offset = pos - XDVDFS_VD_OFFSET;
            return 0;
        }
    }

    return -1;
}

typedef struct {
    FILE *fp;
    uint64_t part_offset;
    xiso_volume_info_t *info;
    xiso_node_t *nodes;
    uint32_t max_nodes;
    uint32_t count;
} traverse_ctx_t;

static void walk_dir_table(traverse_ctx_t *ctx, uint32_t dir_sector, uint32_t dir_size, const char *parent_path, int depth) {
    if (dir_sector == 0 || dir_size == 0 || depth > 32 || dir_size > 32 * 1024 * 1024) return;
    uint8_t *table = (uint8_t *)malloc(dir_size);
    if (!table) return;

    if (fseeko(ctx->fp, (off_t)(ctx->part_offset + (uint64_t)dir_sector * XDVDFS_SECTOR_SIZE), SEEK_SET) != 0 ||
        fread(table, 1, dir_size, ctx->fp) != dir_size) {
        free(table);
        return;
    }

    size_t max_stack = 4096;
    uint32_t *stack = (uint32_t *)malloc(max_stack * sizeof(uint32_t));
    uint8_t *visited = (uint8_t *)calloc((dir_size / 4) + 1, 1);
    if (!stack || !visited) {
        free(stack);
        free(visited);
        free(table);
        return;
    }

    size_t sp = 0;
    stack[sp++] = 0;

    while (sp > 0) {
        uint32_t offset = stack[--sp];
        if (offset + 14 > dir_size) continue;
        uint32_t word_idx = offset / 4;
        if ( visited[word_idx] ) continue;
        visited[word_idx] = 1;

        uint16_t left_words = read_le16(table + offset);
        uint16_t right_words = read_le16(table + offset + 2);
        uint32_t start_sector = read_le32(table + offset + 4);
        uint32_t file_size = read_le32(table + offset + 8);
        uint8_t attrs = table[offset + 12];
        uint8_t name_len = table[offset + 13];

        if (left_words == 0xFFFF && right_words == 0xFFFF && start_sector == 0xFFFFFFFF) continue;
        if (name_len == 0 || offset + 14 + name_len > dir_size) continue;

        if (right_words != 0 && right_words != 0xFFFF && sp + 1 < max_stack) {
            stack[sp++] = (uint32_t)right_words * 4U;
        }
        if (left_words != 0 && left_words != 0xFFFF && sp + 1 < max_stack) {
            stack[sp++] = (uint32_t)left_words * 4U;
        }

        char name[256];
        memcpy(name, table + offset + 14, name_len);
        name[name_len] = '\0';

        char full_path[512];
        if (strcmp(parent_path, "/") == 0) {
            snprintf(full_path, sizeof(full_path), "/%s", name);
        } else {
            snprintf(full_path, sizeof(full_path), "%s/%s", parent_path, name);
        }

        bool is_dir = (attrs & XDVDFS_ATTR_DIR) != 0;
        if (is_dir) {
            ctx->info->total_dirs++;
        } else {
            ctx->info->total_files++;
            ctx->info->total_bytes += file_size;
            if (strcmp(parent_path, "/") == 0 &&
                (strcasecmp(name, "default.xbe") == 0 || strcasecmp(name, "default.xex") == 0)) {
                parse_exec_metadata(ctx->fp, ctx->part_offset, start_sector, file_size, ctx->info);
            }
        }

        if (ctx->nodes && ctx->count < ctx->max_nodes) {
            xiso_node_t *node = &ctx->nodes[ctx->count++];
            snprintf(node->path, sizeof(node->path), "%s", full_path);
            snprintf(node->name, sizeof(node->name), "%s", name);
            node->start_sector = start_sector;
            node->size_bytes = file_size;
            node->attributes = attrs;
            node->is_directory = is_dir;
        }

        if (is_dir && start_sector > 0 && file_size > 0) {
            walk_dir_table(ctx, start_sector, file_size, full_path, depth + 1);
        }
    }

    free(stack);
    free(visited);
    free(table);
}

int xiso_inspect_image(
    const char *iso_path,
    xiso_volume_info_t *out_info,
    xiso_node_t *out_nodes,
    uint32_t max_nodes,
    uint32_t *out_node_count
) {
    if (!iso_path || !out_info) return -1;
    memset(out_info, 0, sizeof(*out_info));
    snprintf(out_info->title_name, sizeof(out_info->title_name), "");
    snprintf(out_info->title_id, sizeof(out_info->title_id), "XDVDFS");

    FILE *fp = fopen(iso_path, "rb");
    if (!fp) return -2;

    uint8_t vd[XDVDFS_SECTOR_SIZE];
    uint64_t part_offset = 0;
    if (find_partition_offset(fp, &part_offset, vd) != 0) {
        fclose(fp);
        return -3;
    }

    out_info->partition_offset = part_offset;
    out_info->root_dir_sector = read_le32(vd + 0x14);
    out_info->root_dir_size = read_le32(vd + 0x18);

    traverse_ctx_t ctx = {
        .fp = fp,
        .part_offset = part_offset,
        .info = out_info,
        .nodes = out_nodes,
        .max_nodes = max_nodes,
        .count = 0
    };

    walk_dir_table(&ctx, out_info->root_dir_sector, out_info->root_dir_size, "/", 0);
    if (out_node_count) *out_node_count = ctx.count;

    fclose(fp);
    return 0;
}

int xiso_extract_single_file(
    const char *iso_path,
    uint64_t partition_offset,
    uint32_t start_sector,
    uint32_t size_bytes,
    const char *dest_file_path,
    bool patch_xbe
) {
    FILE *in_fp = fopen(iso_path, "rb");
    if (!in_fp) return -1;

    FILE *out_fp = fopen(dest_file_path, "wb");
    if (!out_fp) {
        fclose(in_fp);
        return -2;
    }

    uint64_t byte_offset = partition_offset + (uint64_t)start_sector * XDVDFS_SECTOR_SIZE;
    if (fseeko(in_fp, (off_t)byte_offset, SEEK_SET) != 0) {
        fclose(in_fp);
        fclose(out_fp);
        return -3;
    }

    size_t buf_size = 512 * 1024;
    uint8_t *buf = (uint8_t *)malloc(buf_size);
    if (!buf) {
        fclose(in_fp);
        fclose(out_fp);
        return -4;
    }

    uint32_t remaining = size_bytes;
    bool first_chunk = true;
    while (remaining > 0) {
        size_t chunk = remaining < buf_size ? remaining : buf_size;
        size_t r = fread(buf, 1, chunk, in_fp);
        if (r == 0) break;

        if (first_chunk && patch_xbe) {
            patch_xbe_header_if_needed(buf, r);
            first_chunk = false;
        }
        fwrite(buf, 1, r, out_fp);
        remaining -= (uint32_t)r;
    }

    free(buf);
    fclose(in_fp);
    fclose(out_fp);
    return 0;
}

int xiso_extract_all(
    const char *iso_path,
    const char *dest_dir,
    bool patch_xbe,
    xiso_progress_cb progress_cb,
    void *user_data
) {
    xiso_volume_info_t info;
    uint32_t max_nodes = 32768;
    xiso_node_t *nodes = (xiso_node_t *)calloc(max_nodes, sizeof(xiso_node_t));
    if (!nodes) return -1;

    uint32_t count = 0;
    int res = xiso_inspect_image(iso_path, &info, nodes, max_nodes, &count);
    if (res != 0) {
        free(nodes);
        return res;
    }

    mkdir_recursive(dest_dir);

    uint32_t extracted_files = 0;
    for (uint32_t i = 0; i < count; i++) {
        char target_path[1024];
        snprintf(target_path, sizeof(target_path), "%s%s", dest_dir, nodes[i].path);

        if (nodes[i].is_directory) {
            mkdir_recursive(target_path);
        } else {
            extracted_files++;
            if (progress_cb) {
                progress_cb(nodes[i].path, extracted_files, info.total_files, user_data);
            }
            char parent_dir[1024];
            snprintf(parent_dir, sizeof(parent_dir), "%s", target_path);
            char *last_slash = strrchr(parent_dir, '/');
            if (last_slash) {
                *last_slash = '\0';
                mkdir_recursive(parent_dir);
            }
            bool is_xbe = false;
            size_t nlen = strlen(nodes[i].name);
            if (nlen >= 4 && strcasecmp(nodes[i].name + nlen - 4, ".xbe") == 0) {
                is_xbe = true;
            }
            xiso_extract_single_file(
                iso_path,
                info.partition_offset,
                nodes[i].start_sector,
                nodes[i].size_bytes,
                target_path,
                patch_xbe && is_xbe
            );
        }
    }

    free(nodes);
    return 0;
}

int xiso_rewrite_optimized(
    const char *source_iso_path,
    const char *dest_iso_path,
    bool patch_xbe,
    xiso_progress_cb progress_cb,
    void *user_data
) {
    xiso_volume_info_t info;
    int res = xiso_inspect_image(source_iso_path, &info, NULL, 0, NULL);
    if (res != 0) return res;

    FILE *in_fp = fopen(source_iso_path, "rb");
    if (!in_fp) return -1;
    FILE *out_fp = fopen(dest_iso_path, "wb");
    if (!out_fp) {
        fclose(in_fp);
        return -2;
    }

    if (fseeko(in_fp, (off_t)info.partition_offset, SEEK_SET) != 0) {
        fclose(in_fp);
        fclose(out_fp);
        return -3;
    }

    size_t buf_size = 1024 * 1024;
    uint8_t *buf = (uint8_t *)malloc(buf_size);
    if (!buf) {
        fclose(in_fp);
        fclose(out_fp);
        return -4;
    }

    size_t r;
    uint32_t step = 0;
    while ((r = fread(buf, 1, buf_size, in_fp)) > 0) {
        fwrite(buf, 1, r, out_fp);
        step++;
        if (progress_cb && (step % 16 == 0)) {
            progress_cb("/partition_stream.iso", step, step + 10, user_data);
        }
    }

    free(buf);
    fclose(in_fp);
    fclose(out_fp);
    (void)patch_xbe;
    return 0;
}
