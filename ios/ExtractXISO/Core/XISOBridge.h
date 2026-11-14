#ifndef XISOBridge_h
#define XISOBridge_h

#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char path[512];
    char name[256];
    uint32_t start_sector;
    uint32_t size_bytes;
    uint8_t attributes;
    bool is_directory;
} xiso_node_t;

typedef struct {
    uint64_t partition_offset;
    uint32_t root_dir_sector;
    uint32_t root_dir_size;
    uint32_t total_files;
    uint32_t total_dirs;
    uint64_t total_bytes;
    char title_name[64];
    char title_id[16];
} xiso_volume_info_t;

typedef void (*xiso_progress_cb)(const char *current_file, uint32_t processed_files, uint32_t total_files, void *user_data);

int xiso_inspect_image(
    const char *iso_path,
    xiso_volume_info_t *out_info,
    xiso_node_t *out_nodes,
    uint32_t max_nodes,
    uint32_t *out_node_count
);

int xiso_extract_all(
    const char *iso_path,
    const char *dest_dir,
    bool patch_xbe,
    xiso_progress_cb progress_cb,
    void *user_data
);

int xiso_extract_single_file(
    const char *iso_path,
    uint64_t partition_offset,
    uint32_t start_sector,
    uint32_t size_bytes,
    const char *dest_file_path,
    bool patch_xbe
);

int xiso_rewrite_optimized(
    const char *source_iso_path,
    const char *dest_iso_path,
    bool patch_xbe,
    xiso_progress_cb progress_cb,
    void *user_data
);

#ifdef __cplusplus
}
#endif

#endif /* XISOBridge_h */
