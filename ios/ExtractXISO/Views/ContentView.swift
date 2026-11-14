import SwiftUI
import UIKit
import UniformTypeIdentifiers

// MARK: - Multi-Language Localization Engine (25+ Languages + System Auto-Detect)

struct AppLanguageOption: Identifiable, Hashable {
    var id: String { code }
    let code: String
    let nativeName: String
    let englishName: String
}

let SUPPORTED_IOS_LANGUAGES: [AppLanguageOption] = [
    AppLanguageOption(code: "system", nativeName: "Auto (System)", englishName: "System Default"),
    AppLanguageOption(code: "en", nativeName: "English", englishName: "English"),
    AppLanguageOption(code: "it", nativeName: "Italiano", englishName: "Italian"),
    AppLanguageOption(code: "es", nativeName: "Español", englishName: "Spanish"),
    AppLanguageOption(code: "fr", nativeName: "Français", englishName: "French"),
    AppLanguageOption(code: "de", nativeName: "Deutsch", englishName: "German"),
    AppLanguageOption(code: "pt", nativeName: "Português", englishName: "Portuguese"),
    AppLanguageOption(code: "ru", nativeName: "Русский", englishName: "Russian"),
    AppLanguageOption(code: "ja", nativeName: "日本語", englishName: "Japanese"),
    AppLanguageOption(code: "zh-Hans", nativeName: "简体中文", englishName: "Chinese (Simplified)"),
    AppLanguageOption(code: "zh-Hant", nativeName: "繁體中文", englishName: "Chinese (Traditional)"),
    AppLanguageOption(code: "ko", nativeName: "한국어", englishName: "Korean"),
    AppLanguageOption(code: "ar", nativeName: "العربية", englishName: "Arabic"),
    AppLanguageOption(code: "hi", nativeName: "हिन्दी", englishName: "Hindi"),
    AppLanguageOption(code: "tr", nativeName: "Türkçe", englishName: "Turkish"),
    AppLanguageOption(code: "nl", nativeName: "Nederlands", englishName: "Dutch"),
    AppLanguageOption(code: "pl", nativeName: "Polski", englishName: "Polish"),
    AppLanguageOption(code: "sv", nativeName: "Svenska", englishName: "Swedish"),
    AppLanguageOption(code: "uk", nativeName: "Українська", englishName: "Ukrainian"),
    AppLanguageOption(code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese"),
    AppLanguageOption(code: "th", nativeName: "ไทย", englishName: "Thai"),
    AppLanguageOption(code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian"),
    AppLanguageOption(code: "cs", nativeName: "Čeština", englishName: "Czech"),
    AppLanguageOption(code: "el", nativeName: "Ελληνικά", englishName: "Greek"),
    AppLanguageOption(code: "ro", nativeName: "Română", englishName: "Romanian"),
    AppLanguageOption(code: "hu", nativeName: "Magyar", englishName: "Hungarian")
]

struct L10nStrings {
    let settingsTitle: String
    let languageSectionTitle: String
    let searchLanguagePlaceholder: String
    let openIsoButton: String
    let emptyTitle: String
    let emptySubtitle: String
    let searchFilesPlaceholder: String
    let backButton: String
    let folderLabel: String
    let sectorLabel: String
    let filesCountLabel: String
    let extractAllButton: String
    let saveToFilesButton: String
    let doneButton: String
    let readingStatus: String
}

func resolveIOSLanguageCode(_ choice: String) -> String {
    let target: String
    if choice == "system" {
        target = (Locale.preferredLanguages.first ?? "en").lowercased()
    } else {
        target = choice.lowercased()
    }
    if target.hasPrefix("zh-hant") || target.hasPrefix("zh-tw") || target.hasPrefix("zh-hk") {
        return "zh-Hant"
    }
    if target.hasPrefix("zh") {
        return "zh-Hans"
    }
    let prefix = String(target.split(separator: "-").first ?? "en")
    return prefix
}

func getLocalizedStrings(for choice: String) -> L10nStrings {
    let code = resolveIOSLanguageCode(choice)
    switch code {
    case "it":
        return L10nStrings(
            settingsTitle: "Impostazioni",
            languageSectionTitle: "Lingua Applicazione",
            searchLanguagePlaceholder: "Cerca lingua...",
            openIsoButton: "Apri File XISO",
            emptyTitle: "Nessun file XISO aperto",
            emptySubtitle: "Seleziona un'immagine disco Xbox o Xbox 360 (.iso / .xiso) dall'app File di iPhone per esplorare ed estrarre i file.",
            searchFilesPlaceholder: "Cerca file nell'immagine XISO...",
            backButton: "Indietro",
            folderLabel: "Cartella",
            sectorLabel: "Settore",
            filesCountLabel: "file",
            extractAllButton: "Estrai Tutto in Cartella (-x)",
            saveToFilesButton: "Salva in File",
            doneButton: "Chiudi",
            readingStatus: "Lettura struttura XDVDFS..."
        )
    case "es":
        return L10nStrings(
            settingsTitle: "Ajustes",
            languageSectionTitle: "Idioma de la aplicación",
            searchLanguagePlaceholder: "Buscar idioma...",
            openIsoButton: "Abrir archivo XISO",
            emptyTitle: "Ningún archivo XISO abierto",
            emptySubtitle: "Selecciona una imagen de disco Xbox o Xbox 360 (.iso / .xiso) desde la app Archivos para explorar y extraer archivos.",
            searchFilesPlaceholder: "Buscar archivos en XISO...",
            backButton: "Atrás",
            folderLabel: "Carpeta",
            sectorLabel: "Sector",
            filesCountLabel: "archivos",
            extractAllButton: "Extraer todo en carpeta (-x)",
            saveToFilesButton: "Guardar en Archivos",
            doneButton: "Cerrar",
            readingStatus: "Leyendo estructura XDVDFS..."
        )
    case "fr":
        return L10nStrings(
            settingsTitle: "Paramètres",
            languageSectionTitle: "Langue de l'application",
            searchLanguagePlaceholder: "Rechercher une langue...",
            openIsoButton: "Ouvrir fichier XISO",
            emptyTitle: "Aucun fichier XISO ouvert",
            emptySubtitle: "Sélectionnez une image disque Xbox ou Xbox 360 (.iso / .xiso) dans l'app Fichiers pour parcourir et extraire les fichiers.",
            searchFilesPlaceholder: "Rechercher dans XISO...",
            backButton: "Retour",
            folderLabel: "Dossier",
            sectorLabel: "Secteur",
            filesCountLabel: "fichiers",
            extractAllButton: "Tout extraire dans un dossier (-x)",
            saveToFilesButton: "Enregistrer dans Fichiers",
            doneButton: "Fermer",
            readingStatus: "Lecture de la structure XDVDFS..."
        )
    case "de":
        return L10nStrings(
            settingsTitle: "Einstellungen",
            languageSectionTitle: "App-Sprache",
            searchLanguagePlaceholder: "Sprache suchen...",
            openIsoButton: "XISO-Datei öffnen",
            emptyTitle: "Keine XISO-Datei geöffnet",
            emptySubtitle: "Wählen Sie ein Xbox- oder Xbox 360-Abbild (.iso / .xiso) aus der Dateien-App, um Dateien zu durchsuchen und zu extrahieren.",
            searchFilesPlaceholder: "Dateien in XISO suchen...",
            backButton: "Zurück",
            folderLabel: "Ordner",
            sectorLabel: "Sektor",
            filesCountLabel: "Dateien",
            extractAllButton: "Alles in Ordner extrahieren (-x)",
            saveToFilesButton: "In Dateien sichern",
            doneButton: "Schließen",
            readingStatus: "Lese XDVDFS-Struktur..."
        )
    case "pt":
        return L10nStrings(
            settingsTitle: "Configurações",
            languageSectionTitle: "Idioma do Aplicativo",
            searchLanguagePlaceholder: "Pesquisar idioma...",
            openIsoButton: "Abrir Arquivo XISO",
            emptyTitle: "Nenhum arquivo XISO aberto",
            emptySubtitle: "Selecione uma imagem de disco Xbox ou Xbox 360 (.iso / .xiso) no app Arquivos para explorar e extrair.",
            searchFilesPlaceholder: "Pesquisar arquivos...",
            backButton: "Voltar",
            folderLabel: "Pasta",
            sectorLabel: "Setor",
            filesCountLabel: "arquivos",
            extractAllButton: "Extrair Tudo na Pasta (-x)",
            saveToFilesButton: "Salvar em Arquivos",
            doneButton: "Fechar",
            readingStatus: "Lendo estrutura XDVDFS..."
        )
    case "ru":
        return L10nStrings(
            settingsTitle: "Настройки",
            languageSectionTitle: "Язык приложения",
            searchLanguagePlaceholder: "Поиск языка...",
            openIsoButton: "Открыть файл XISO",
            emptyTitle: "Файл XISO не открыт",
            emptySubtitle: "Выберите образ диска Xbox или Xbox 360 (.iso / .xiso) в приложении «Файлы» для просмотра и извлечения.",
            searchFilesPlaceholder: "Поиск файлов...",
            backButton: "Назад",
            folderLabel: "Папка",
            sectorLabel: "Сектор",
            filesCountLabel: "файлов",
            extractAllButton: "Извлечь всё в папку (-x)",
            saveToFilesButton: "Сохранить в Файлы",
            doneButton: "Закрыть",
            readingStatus: "Чтение структуры XDVDFS..."
        )
    case "ja":
        return L10nStrings(
            settingsTitle: "設定",
            languageSectionTitle: "表示言語",
            searchLanguagePlaceholder: "言語を検索...",
            openIsoButton: "XISOファイルを開く",
            emptyTitle: "XISOが開かれていません",
            emptySubtitle: "「ファイル」アプリからXboxまたはXbox 360ディスクイメージ (.iso / .xiso) を選択して展開します。",
            searchFilesPlaceholder: "ファイルを検索...",
            backButton: "戻る",
            folderLabel: "フォルダ",
            sectorLabel: "セクタ",
            filesCountLabel: "ファイル",
            extractAllButton: "すべてフォルダに展開 (-x)",
            saveToFilesButton: "ファイルに保存",
            doneButton: "閉じる",
            readingStatus: "XDVDFS構造を読み込み中..."
        )
    case "zh-Hans":
        return L10nStrings(
            settingsTitle: "设置",
            languageSectionTitle: "应用语言",
            searchLanguagePlaceholder: "搜索语言...",
            openIsoButton: "打开 XISO 文件",
            emptyTitle: "未打开 XISO 文件",
            emptySubtitle: "从 iPhone“文件”应用中选择 Xbox 或 Xbox 360 镜像 (.iso / .xiso) 以浏览和提取文件。",
            searchFilesPlaceholder: "搜索镜像中的文件...",
            backButton: "返回",
            folderLabel: "文件夹",
            sectorLabel: "扇区",
            filesCountLabel: "个文件",
            extractAllButton: "全部提取到文件夹 (-x)",
            saveToFilesButton: "存储到“文件”",
            doneButton: "关闭",
            readingStatus: "正在读取 XDVDFS 结构..."
        )
    case "zh-Hant":
        return L10nStrings(
            settingsTitle: "設定",
            languageSectionTitle: "應用程式語言",
            searchLanguagePlaceholder: "搜尋語言...",
            openIsoButton: "開啟 XISO 檔案",
            emptyTitle: "尚未開啟 XISO 檔案",
            emptySubtitle: "從 iPhone「檔案」中選擇 Xbox 或 Xbox 360 映像檔 (.iso / .xiso) 以瀏覽及擷取檔案。",
            searchFilesPlaceholder: "搜尋檔案...",
            backButton: "返回",
            folderLabel: "資料夾",
            sectorLabel: "磁區",
            filesCountLabel: "個檔案",
            extractAllButton: "全部擷取至資料夾 (-x)",
            saveToFilesButton: "儲存到「檔案」",
            doneButton: "關閉",
            readingStatus: "正在讀取 XDVDFS 結構..."
        )
    case "ko":
        return L10nStrings(
            settingsTitle: "설정",
            languageSectionTitle: "앱 언어",
            searchLanguagePlaceholder: "언어 검색...",
            openIsoButton: "XISO 파일 열기",
            emptyTitle: "열린 XISO 파일 없음",
            emptySubtitle: "파일 앱에서 Xbox 또는 Xbox 360 디스크 이미지(.iso / .xiso)를 선택하여 파일을 탐색하고 추출하세요.",
            searchFilesPlaceholder: "파일 검색...",
            backButton: "뒤로",
            folderLabel: "폴더",
            sectorLabel: "섹터",
            filesCountLabel: "파일",
            extractAllButton: "폴더로 전체 추출 (-x)",
            saveToFilesButton: "파일 앱에 저장",
            doneButton: "닫기",
            readingStatus: "XDVDFS 구조 읽는 중..."
        )
    case "ar":
        return L10nStrings(
            settingsTitle: "الإعدادات",
            languageSectionTitle: "لغة التطبيق",
            searchLanguagePlaceholder: "ابحث عن اللغة...",
            openIsoButton: "فتح ملف XISO",
            emptyTitle: "لم يتم فتح ملف XISO",
            emptySubtitle: "اختر صورة قرص Xbox أو Xbox 360 (.iso / .xiso) من تطبيق الملفات لتصفح واستخراج الملفات.",
            searchFilesPlaceholder: "البحث عن ملفات...",
            backButton: "رجوع",
            folderLabel: "مجلد",
            sectorLabel: "قطاع",
            filesCountLabel: "ملفات",
            extractAllButton: "استخراج الكل إلى مجلد (-x)",
            saveToFilesButton: "حفظ في الملفات",
            doneButton: "إغلاق",
            readingStatus: "جاري قراءة بنية XDVDFS..."
        )
    case "hi":
        return L10nStrings(
            settingsTitle: "सेटिंग्स",
            languageSectionTitle: "ऐप की भाषा",
            searchLanguagePlaceholder: "भाषा खोजें...",
            openIsoButton: "XISO फ़ाइल खोलें",
            emptyTitle: "कोई XISO फ़ाइल नहीं खुली है",
            emptySubtitle: "फ़ाइलें ब्राउज़ करने और निकालने के लिए Files ऐप से Xbox या Xbox 360 (.iso / .xiso) इमेज चुनें।",
            searchFilesPlaceholder: "फ़ाइलें खोजें...",
            backButton: "पीछे",
            folderLabel: "फ़ोल्डर",
            sectorLabel: "सेक्टर",
            filesCountLabel: "फ़ाइलें",
            extractAllButton: "फ़ोल्डर में सभी निकालें (-x)",
            saveToFilesButton: "Files में सहेजें",
            doneButton: "बंद करें",
            readingStatus: "XDVDFS संरचना पढ़ी जा रही है..."
        )
    case "tr":
        return L10nStrings(
            settingsTitle: "Ayarlar",
            languageSectionTitle: "Uygulama Dili",
            searchLanguagePlaceholder: "Dil ara...",
            openIsoButton: "XISO Dosyası Aç",
            emptyTitle: "Açık XISO dosyası yok",
            emptySubtitle: "Dosyaları çıkartmak için Dosyalar uygulamasından bir Xbox veya Xbox 360 (.iso / .xiso) kalıbı seçin.",
            searchFilesPlaceholder: "Dosya ara...",
            backButton: "Geri",
            folderLabel: "Klasör",
            sectorLabel: "Sektör",
            filesCountLabel: "dosya",
            extractAllButton: "Tümünü Klasöre Çıkart (-x)",
            saveToFilesButton: "Dosyalara Kaydet",
            doneButton: "Kapat",
            readingStatus: "XDVDFS yapısı okunuyor..."
        )
    case "nl":
        return L10nStrings(
            settingsTitle: "Instellingen",
            languageSectionTitle: "Apptaal",
            searchLanguagePlaceholder: "Zoek taal...",
            openIsoButton: "XISO-bestand openen",
            emptyTitle: "Geen XISO-bestand geopend",
            emptySubtitle: "Selecteer een Xbox- of Xbox 360-image (.iso / .xiso) in de Bestanden-app om bestanden uit te pakken.",
            searchFilesPlaceholder: "Bestanden zoeken...",
            backButton: "Terug",
            folderLabel: "Map",
            sectorLabel: "Sector",
            filesCountLabel: "bestanden",
            extractAllButton: "Alles uitpakken naar map (-x)",
            saveToFilesButton: "Bewaar in Bestanden",
            doneButton: "Sluiten",
            readingStatus: "XDVDFS-structuur lezen..."
        )
    case "pl":
        return L10nStrings(
            settingsTitle: "Ustawienia",
            languageSectionTitle: "Język aplikacji",
            searchLanguagePlaceholder: "Szukaj języka...",
            openIsoButton: "Otwórz plik XISO",
            emptyTitle: "Nie otwarto pliku XISO",
            emptySubtitle: "Wybierz obraz płyty Xbox lub Xbox 360 (.iso / .xiso) z aplikacji Pliki, aby przeglądać i wypakować pliki.",
            searchFilesPlaceholder: "Szukaj plików...",
            backButton: "Wstecz",
            folderLabel: "Folder",
            sectorLabel: "Sektor",
            filesCountLabel: "plików",
            extractAllButton: "Wypakuj wszystko do folderu (-x)",
            saveToFilesButton: "Zapisz w Plikach",
            doneButton: "Zamknij",
            readingStatus: "Odczytywanie struktury XDVDFS..."
        )
    case "sv":
        return L10nStrings(
            settingsTitle: "Inställningar",
            languageSectionTitle: "Appspråk",
            searchLanguagePlaceholder: "Sök språk...",
            openIsoButton: "Öppna XISO-fil",
            emptyTitle: "Ingen XISO-fil öppen",
            emptySubtitle: "Välj en Xbox- eller Xbox 360-avbildning (.iso / .xiso) i Filer-appen för att extrahera filer.",
            searchFilesPlaceholder: "Sök filer...",
            backButton: "Tillbaka",
            folderLabel: "Mapp",
            sectorLabel: "Sektor",
            filesCountLabel: "filer",
            extractAllButton: "Extrahera allt till mapp (-x)",
            saveToFilesButton: "Spara i Filer",
            doneButton: "Stäng",
            readingStatus: "Läser XDVDFS-struktur..."
        )
    case "uk":
        return L10nStrings(
            settingsTitle: "Налаштування",
            languageSectionTitle: "Мова застосунку",
            searchLanguagePlaceholder: "Пошук мови...",
            openIsoButton: "Відкрити XISO",
            emptyTitle: "Файл XISO не відкрито",
            emptySubtitle: "Виберіть образ диска Xbox або Xbox 360 (.iso / .xiso) у програмі «Файли» для перегляду та видобування.",
            searchFilesPlaceholder: "Пошук файлів...",
            backButton: "Назад",
            folderLabel: "Папка",
            sectorLabel: "Сектор",
            filesCountLabel: "файлів",
            extractAllButton: "Видобути все в папку (-x)",
            saveToFilesButton: "Зберегти у Файли",
            doneButton: "Закрити",
            readingStatus: "Читання структури XDVDFS..."
        )
    case "vi":
        return L10nStrings(
            settingsTitle: "Cài đặt",
            languageSectionTitle: "Ngôn ngữ ứng dụng",
            searchLanguagePlaceholder: "Tìm ngôn ngữ...",
            openIsoButton: "Mở tệp XISO",
            emptyTitle: "Chưa mở tệp XISO",
            emptySubtitle: "Chọn tệp ảnh đĩa Xbox hoặc Xbox 360 (.iso / .xiso) từ ứng dụng Tệp để duyệt và giải nén.",
            searchFilesPlaceholder: "Tìm kiếm tệp...",
            backButton: "Quay lại",
            folderLabel: "Thư mục",
            sectorLabel: "Sector",
            filesCountLabel: "tệp",
            extractAllButton: "Giải nén tất cả vào thư mục (-x)",
            saveToFilesButton: "Lưu vào Tệp",
            doneButton: "Đóng",
            readingStatus: "Đang đọc cấu trúc XDVDFS..."
        )
    case "th":
        return L10nStrings(
            settingsTitle: "การตั้งค่า",
            languageSectionTitle: "ภาษาของแอป",
            searchLanguagePlaceholder: "ค้นหาภาษา...",
            openIsoButton: "เปิดไฟล์ XISO",
            emptyTitle: "ไม่ได้เปิดไฟล์ XISO",
            emptySubtitle: "เลือกไฟล์ Xbox หรือ Xbox 360 (.iso / .xiso) จากแอปไฟล์เพื่อสำรวจและแตกไฟล์",
            searchFilesPlaceholder: "ค้นหาไฟล์...",
            backButton: "ย้อนกลับ",
            folderLabel: "โฟลเดอร์",
            sectorLabel: "เซกเตอร์",
            filesCountLabel: "ไฟล์",
            extractAllButton: "แตกไฟล์ทั้งหมดลงโฟลเดอร์ (-x)",
            saveToFilesButton: "บันทึกไปยังแอปไฟล์",
            doneButton: "ปิด",
            readingStatus: "กำลังอ่านโครงสร้าง XDVDFS..."
        )
    case "id":
        return L10nStrings(
            settingsTitle: "Pengaturan",
            languageSectionTitle: "Bahasa Aplikasi",
            searchLanguagePlaceholder: "Cari bahasa...",
            openIsoButton: "Buka File XISO",
            emptyTitle: "Tidak ada file XISO yang dibuka",
            emptySubtitle: "Pilih image disk Xbox atau Xbox 360 (.iso / .xiso) dari aplikasi File untuk mengekstrak.",
            searchFilesPlaceholder: "Cari file...",
            backButton: "Kembali",
            folderLabel: "Folder",
            sectorLabel: "Sektor",
            filesCountLabel: "file",
            extractAllButton: "Ekstrak Semua ke Folder (-x)",
            saveToFilesButton: "Simpan ke File",
            doneButton: "Tutup",
            readingStatus: "Membaca struktur XDVDFS..."
        )
    case "cs":
        return L10nStrings(
            settingsTitle: "Nastavení",
            languageSectionTitle: "Jazyk aplikace",
            searchLanguagePlaceholder: "Hledat jazyk...",
            openIsoButton: "Otevřít XISO soubor",
            emptyTitle: "Žádný XISO soubor není otevřen",
            emptySubtitle: "Vyberte obraz disku Xbox nebo Xbox 360 (.iso / .xiso) z aplikace Soubory pro extrakci.",
            searchFilesPlaceholder: "Hledat soubory...",
            backButton: "Zpět",
            folderLabel: "Složka",
            sectorLabel: "Sektor",
            filesCountLabel: "souborů",
            extractAllButton: "Extrahovat vše do složky (-x)",
            saveToFilesButton: "Uložit do Souborů",
            doneButton: "Zavřít",
            readingStatus: "Čtení struktury XDVDFS..."
        )
    case "el":
        return L10nStrings(
            settingsTitle: "Ρυθμίσεις",
            languageSectionTitle: "Γλώσσα Εφαρμογής",
            searchLanguagePlaceholder: "Αναζήτηση γλώσσας...",
            openIsoButton: "Άνοιγμα αρχείου XISO",
            emptyTitle: "Δεν έχει ανοιχτεί αρχείο XISO",
            emptySubtitle: "Επιλέξτε ένα είδωλο Xbox ή Xbox 360 (.iso / .xiso) από την εφαρμογή Αρχεία για εξαγωγή.",
            searchFilesPlaceholder: "Αναζήτηση αρχείων...",
            backButton: "Πίσω",
            folderLabel: "Φάκελος",
            sectorLabel: "Τομέας",
            filesCountLabel: "αρχεία",
            extractAllButton: "Εξαγωγή όλων σε φάκελο (-x)",
            saveToFilesButton: "Αποθήκευση στα Αρχεία",
            doneButton: "Κλείσιμο",
            readingStatus: "Ανάγνωση δομής XDVDFS..."
        )
    case "ro":
        return L10nStrings(
            settingsTitle: "Setări",
            languageSectionTitle: "Limba aplicației",
            searchLanguagePlaceholder: "Caută limba...",
            openIsoButton: "Deschide fișier XISO",
            emptyTitle: "Niciun fișier XISO deschis",
            emptySubtitle: "Selectează o imagine Xbox sau Xbox 360 (.iso / .xiso) din aplicația Fișiere pentru extragere.",
            searchFilesPlaceholder: "Caută fișiere...",
            backButton: "Înapoi",
            folderLabel: "Dosar",
            sectorLabel: "Sector",
            filesCountLabel: "fișiere",
            extractAllButton: "Extrage tot în dosar (-x)",
            saveToFilesButton: "Salvează în Fișiere",
            doneButton: "Închide",
            readingStatus: "Se citește structura XDVDFS..."
        )
    case "hu":
        return L10nStrings(
            settingsTitle: "Beállítások",
            languageSectionTitle: "Alkalmazás nyelve",
            searchLanguagePlaceholder: "Nyelv keresése...",
            openIsoButton: "XISO fájl megnyitása",
            emptyTitle: "Nincs megnyitva XISO fájl",
            emptySubtitle: "Válasszon egy Xbox vagy Xbox 360 (.iso / .xiso) lemezképet a Fájlok alkalmazásból a kibontáshoz.",
            searchFilesPlaceholder: "Fájlok keresése...",
            backButton: "Vissza",
            folderLabel: "Mappa",
            sectorLabel: "Szektor",
            filesCountLabel: "fájl",
            extractAllButton: "Összes kibontása mappába (-x)",
            saveToFilesButton: "Mentés a Fájlokba",
            doneButton: "Bezárás",
            readingStatus: "XDVDFS struktúra olvasása..."
        )
    default:
        return L10nStrings(
            settingsTitle: "Settings",
            languageSectionTitle: "Application Language",
            searchLanguagePlaceholder: "Search language...",
            openIsoButton: "Open XISO File",
            emptyTitle: "No XISO File Open",
            emptySubtitle: "Select an Xbox or Xbox 360 disc image (.iso / .xiso) from the iPhone Files app to browse and extract files.",
            searchFilesPlaceholder: "Search files in XISO...",
            backButton: "Back",
            folderLabel: "Folder",
            sectorLabel: "Sector",
            filesCountLabel: "files",
            extractAllButton: "Extract All to Folder (-x)",
            saveToFilesButton: "Save to Files",
            doneButton: "Close",
            readingStatus: "Reading XDVDFS structure..."
        )
    }
}

struct XISOItem: Identifiable, Hashable {
    let id = UUID()
    let path: String
    let name: String
    let startSector: UInt32
    let sizeBytes: UInt32
    let isDirectory: Bool
    var parentPath: String {
        let comps = path.split(separator: "/")
        if comps.count <= 1 { return "/" }
        return "/" + comps.dropLast().joined(separator: "/")
    }
}

struct DocumentPickerView: UIViewControllerRepresentable {
    var onPick: (URL) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick)
    }

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker: UIDocumentPickerViewController
        if #available(iOS 14.0, *) {
            picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item, .data, .diskImage], asCopy: false)
        } else {
            picker = UIDocumentPickerViewController(documentTypes: ["public.item", "public.data", "public.disk-image"], in: .open)
        }
        picker.allowsMultipleSelection = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (URL) -> Void
        init(onPick: @escaping (URL) -> Void) {
            self.onPick = onPick
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let first = urls.first else { return }
            onPick(first)
        }

        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentAt url: URL) {
            onPick(url)
        }
    }
}

struct DocumentExportPickerView: UIViewControllerRepresentable {
    let urlToExport: URL

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        UIDocumentPickerViewController(forExporting: [urlToExport], asCopy: true)
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
}

struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private var activeProgressBridge: ((String, UInt32, UInt32) -> Void)?

private let cProgressCallback: xiso_progress_cb = { currentFilePtr, processed, total, _ in
    let fileStr = currentFilePtr != nil ? String(cString: currentFilePtr!) : ""
    DispatchQueue.main.async {
        activeProgressBridge?(fileStr, processed, total)
    }
}

final class XISOViewModel: ObservableObject {
    @Published var isoURL: URL?
    @Published var titleName: String = ""
    @Published var titleID: String = ""
    @Published var partitionOffset: UInt64 = 0
    @Published var totalFiles: UInt32 = 0
    @Published var totalDirs: UInt32 = 0
    @Published var totalBytes: UInt64 = 0
    @Published var items: [XISOItem] = []
    @Published var currentDirectory: String = "/"
    @Published var searchQuery: String = ""
    @Published var patchXbe: Bool = true

    @Published var isLoadingISO: Bool = false
    @Published var isExtracting: Bool = false
    @Published var progressCurrentFile: String = ""
    @Published var progressProcessed: UInt32 = 0
    @Published var progressTotal: UInt32 = 0

    @Published var statusMessage: String = ""
    @Published var errorMessage: String = ""

    @Published var exportURL: URL?
    @Published var showExportPicker: Bool = false
    @Published var showShareSheet: Bool = false

    private var securityScopedURL: URL?
    private var hasSecurityScope: Bool = false

    deinit {
        releaseSecurityScope()
    }

    private func releaseSecurityScope() {
        if hasSecurityScope, let prev = securityScopedURL {
            prev.stopAccessingSecurityScopedResource()
        }
        hasSecurityScope = false
        securityScopedURL = nil
    }

    var visibleItems: [XISOItem] {
        let filtered = items.filter { item in
            if !searchQuery.trimmingCharacters(in: .whitespaces).isEmpty {
                return item.name.localizedCaseInsensitiveContains(searchQuery)
            }
            return item.parentPath == currentDirectory
        }
        return filtered.sorted { a, b in
            if a.isDirectory != b.isDirectory {
                return a.isDirectory && !b.isDirectory
            }
            return a.name.localizedCaseInsensitiveCompare(b.name) == .orderedAscending
        }
    }

    func loadISO(from url: URL, readingLabel: String) {
        releaseSecurityScope()
        let accessed = url.startAccessingSecurityScopedResource()
        self.securityScopedURL = url
        self.hasSecurityScope = accessed

        self.errorMessage = ""
        self.statusMessage = "\(readingLabel) (\(url.lastPathComponent))"
        self.isLoadingISO = true

        DispatchQueue.global(qos: .userInitiated).async {
            var resolvedPath = url.path

            if fopen(resolvedPath, "rb") == nil {
                var coordError: NSError?
                NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordError) { newURL in
                    resolvedPath = newURL.path
                }
            }

            var info = xiso_volume_info_t()
            let maxNodes: UInt32 = 32768
            let rawNodes = UnsafeMutablePointer<xiso_node_t>.allocate(capacity: Int(maxNodes))
            defer { rawNodes.deallocate() }

            var count: UInt32 = 0
            let result = xiso_inspect_image(resolvedPath, &info, rawNodes, maxNodes, &count)

            if result != 0 {
                DispatchQueue.main.async {
                    self.isLoadingISO = false
                    self.errorMessage = "XDVDFS signature (MICROSOFT*XBOX*MEDIA) not found in \(url.lastPathComponent) (code \(result))."
                    self.statusMessage = ""
                }
                return
            }

            let parsedTitle = withUnsafePointer(to: &info.title_name) {
                $0.withMemoryRebound(to: CChar.self, capacity: 64) { String(cString: $0) }
            }
            let parsedID = withUnsafePointer(to: &info.title_id) {
                $0.withMemoryRebound(to: CChar.self, capacity: 16) { String(cString: $0) }
            }

            var parsedItems: [XISOItem] = []
            parsedItems.reserveCapacity(Int(count))
            for i in 0..<Int(count) {
                var n = rawNodes[i]
                let pathStr = withUnsafePointer(to: &n.path) {
                    $0.withMemoryRebound(to: CChar.self, capacity: 512) { String(cString: $0) }
                }
                let nameStr = withUnsafePointer(to: &n.name) {
                    $0.withMemoryRebound(to: CChar.self, capacity: 256) { String(cString: $0) }
                }
                parsedItems.append(
                    XISOItem(
                        path: pathStr,
                        name: nameStr,
                        startSector: n.start_sector,
                        sizeBytes: n.size_bytes,
                        isDirectory: n.is_directory
                    )
                )
            }

            DispatchQueue.main.async {
                self.isLoadingISO = false
                self.isoURL = URL(fileURLWithPath: resolvedPath)
                self.partitionOffset = info.partition_offset
                self.totalFiles = info.total_files
                self.totalDirs = info.total_dirs
                self.totalBytes = info.total_bytes
                self.titleName = parsedTitle.isEmpty ? url.deletingPathExtension().lastPathComponent : parsedTitle
                self.titleID = parsedID
                self.items = parsedItems
                self.currentDirectory = "/"
                self.statusMessage = "\(info.total_files) files · Offset 0x\(String(info.partition_offset, radix: 16, uppercase: true))"
            }
        }
    }

    func extractSingle(_ item: XISOItem) {
        guard let isoURL = isoURL, !isExtracting else { return }
        isExtracting = true
        errorMessage = ""
        progressCurrentFile = item.name
        progressProcessed = 0
        progressTotal = 1

        let outURL = FileManager.default.temporaryDirectory.appendingPathComponent(item.name)
        try? FileManager.default.removeItem(at: outURL)

        let patch = patchXbe && item.name.lowercased().hasSuffix(".xbe")
        let partOffset = self.partitionOffset

        DispatchQueue.global(qos: .userInitiated).async {
            let res = xiso_extract_single_file(
                isoURL.path,
                partOffset,
                item.startSector,
                item.sizeBytes,
                outURL.path,
                patch
            )
            DispatchQueue.main.async {
                self.isExtracting = false
                if res == 0 {
                    self.exportURL = outURL
                    self.showExportPicker = true
                    self.statusMessage = item.name
                } else {
                    self.errorMessage = "Error extracting \(item.name) (\(res))."
                }
            }
        }
    }

    func extractAllToFolder() {
        guard let isoURL = isoURL, !isExtracting else { return }
        isExtracting = true
        errorMessage = ""
        progressProcessed = 0
        progressTotal = totalFiles
        progressCurrentFile = "..."

        let baseName = isoURL.deletingPathExtension().lastPathComponent
        let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let destURL = docsDir.appendingPathComponent(baseName)
        try? FileManager.default.removeItem(at: destURL)
        let patch = patchXbe

        activeProgressBridge = { [weak self] file, proc, tot in
            self?.progressCurrentFile = file
            self?.progressProcessed = proc
            self?.progressTotal = tot
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let res = xiso_extract_all(isoURL.path, destURL.path, patch, cProgressCallback, nil)
            DispatchQueue.main.async {
                activeProgressBridge = nil
                self.isExtracting = false
                if res == 0 {
                    self.exportURL = destURL
                    self.statusMessage = "Documents/\(baseName)"
                    self.showExportPicker = true
                } else {
                    self.errorMessage = "Extraction error (\(res))."
                }
            }
        }
    }
}

struct CreditsView: View {
    var body: some View {
        List {
            Section(header: Text("Open Source & Upstream Project")) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Extract-XISO for iOS")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("This application is Open Source software released under the BSD 4-Clause License. It is the native iOS port of the official extract-xiso command-line utility.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    if let url = URL(string: "https://github.com/xboxdev/extract-xiso") {
                        Link("https://github.com/xboxdev/extract-xiso", destination: url)
                            .font(.caption.monospaced())
                            .foregroundColor(.green)
                    }
                    Text("Originally created by in <in@fishtank.com> and maintained by the XboxDev open-source community.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }

            Section(header: Text("Software & Technologies Used")) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("• Google AI Studio — Engineered and developed with Google AI Studio")
                    Text("• Swift 5 & SwiftUI — Native iOS interface & multi-language localization")
                    Text("• UIKit DocumentPicker — Zero-copy in-place ISO access & LiveContainer compatibility")
                    Text("• C11 & POSIX File I/O (XISOBridge) — 64-bit binary XDVDFS parser, Redump XGD1/XGD2/XGD3 partition detector, and .xbe media flag patcher")
                    Text("• XcodeGen & GitHub Actions — Automated macOS cloud build pipeline for unsigned .ipa generation")
                    Text("• React, TypeScript, Vite & Tailwind CSS — Companion web application & streaming ZIP64 archive engine")
                }
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.vertical, 4)
            }

            Section {
                HStack {
                    Spacer()
                    Text("Created with ❤️ by hiperema")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                    Spacer()
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle("Credits")
        .navigationBarTitleDisplayMode(.inline)
        .preferredColorScheme(.dark)
    }
}

struct SettingsLanguageSheet: View {
    @Binding var selectedLanguage: String
    @Environment(\.dismiss) private var dismiss
    @State private var searchText: String = ""

    private var l10n: L10nStrings {
        getLocalizedStrings(for: selectedLanguage)
    }

    private var filteredLanguages: [AppLanguageOption] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if q.isEmpty { return SUPPORTED_IOS_LANGUAGES }
        return SUPPORTED_IOS_LANGUAGES.filter {
            $0.nativeName.localizedCaseInsensitiveContains(q) ||
            $0.englishName.localizedCaseInsensitiveContains(q) ||
            $0.code.localizedCaseInsensitiveContains(q)
        }
    }

    var body: some View {
        NavigationView {
            List {
                Section(header: Text(l10n.languageSectionTitle)) {
                    ForEach(filteredLanguages) { lang in
                        Button {
                            selectedLanguage = lang.code
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(lang.nativeName)
                                        .font(.body.weight(.semibold))
                                        .foregroundColor(.primary)
                                    Text(lang.englishName)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                Spacer()
                                if selectedLanguage == lang.code {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                }
                            }
                        }
                    }
                }

                Section(header: Text("About")) {
                    NavigationLink(destination: CreditsView()) {
                        HStack(spacing: 12) {
                            Image(systemName: "info.circle.fill")
                                .foregroundColor(.green)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Credits")
                                    .font(.body.weight(.semibold))
                                    .foregroundColor(.primary)
                                Text("Open Source, XboxDev & Software Stack")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            .searchable(text: $searchText, prompt: l10n.searchLanguagePlaceholder)
            .navigationTitle(l10n.settingsTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(l10n.doneButton) {
                        dismiss()
                    }
                    .foregroundColor(.green)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct ContentView: View {
    @StateObject private var vm = XISOViewModel()
    @AppStorage("extract_xiso_language") private var selectedLanguage: String = "system"
    @State private var showDocumentPicker = false
    @State private var showSettingsSheet = false

    private let xboxGreen = Color(red: 0.063, green: 0.486, blue: 0.063)
    private let darkBg = Color(red: 0.035, green: 0.051, blue: 0.086)
    private let cardBg = Color(red: 0.067, green: 0.094, blue: 0.153)

    private var l10n: L10nStrings {
        getLocalizedStrings(for: selectedLanguage)
    }

    var body: some View {
        NavigationView {
            ZStack {
                darkBg.ignoresSafeArea()

                VStack(spacing: 0) {
                    if !vm.errorMessage.isEmpty {
                        HStack {
                            Text(vm.errorMessage)
                                .font(.caption)
                                .foregroundColor(.red)
                            Spacer()
                            Button {
                                vm.errorMessage = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                        .padding(12)
                        .background(Color.red.opacity(0.15))
                    }

                    if vm.isLoadingISO {
                        VStack(spacing: 16) {
                            ProgressView()
                                .scaleEffect(1.4)
                                .tint(.green)
                            Text(vm.statusMessage)
                                .font(.subheadline)
                                .foregroundColor(.white)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, 24)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if vm.isoURL == nil {
                        emptyStateView
                    } else {
                        volumeHeaderBar
                        if vm.isExtracting {
                            extractionProgressView
                        }
                        breadcrumbBar
                        fileListView
                        bottomToolbar
                    }
                }
            }
            .navigationTitle("Extract-XISO")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        showSettingsSheet = true
                    } label: {
                        Image(systemName: "gearshape.fill")
                            .foregroundColor(.green)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showDocumentPicker = true
                    } label: {
                        Image(systemName: "opticaldisc")
                            .foregroundColor(.green)
                    }
                }
            }
            .sheet(isPresented: $showSettingsSheet) {
                SettingsLanguageSheet(selectedLanguage: $selectedLanguage)
            }
            .sheet(isPresented: $showDocumentPicker) {
                DocumentPickerView { pickedURL in
                    vm.loadISO(from: pickedURL, readingLabel: l10n.readingStatus)
                }
            }
            .sheet(isPresented: $vm.showExportPicker) {
                if let exportURL = vm.exportURL {
                    DocumentExportPickerView(urlToExport: exportURL)
                }
            }
            .sheet(isPresented: $vm.showShareSheet) {
                if let exportURL = vm.exportURL {
                    ActivityView(activityItems: [exportURL])
                }
            }
            .onOpenURL { incomingURL in
                vm.loadISO(from: incomingURL, readingLabel: l10n.readingStatus)
            }
        }
        .navigationViewStyle(.stack)
    }

    private var emptyStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "opticaldisc.fill")
                .font(.system(size: 64))
                .foregroundColor(.green)

            Text(l10n.emptyTitle)
                .font(.title2.bold())
                .foregroundColor(.white)

            Text(l10n.emptySubtitle)
                .font(.subheadline)
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button {
                showDocumentPicker = true
            } label: {
                HStack {
                    Image(systemName: "folder.badge.plus")
                    Text(l10n.openIsoButton)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.white)
                .padding(.vertical, 14)
                .padding(.horizontal, 28)
                .background(xboxGreen)
                .cornerRadius(12)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var extractionProgressView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(vm.progressCurrentFile)
                    .font(.caption.monospaced())
                    .foregroundColor(.green)
                    .lineLimit(1)
                Spacer()
                Text("\(vm.progressProcessed) / \(vm.progressTotal)")
                    .font(.caption.monospaced())
                    .foregroundColor(.white)
            }
            ProgressView(
                value: Double(vm.progressProcessed),
                total: Double(max(1, vm.progressTotal))
            )
            .tint(.green)
        }
        .padding(12)
        .background(Color.black.opacity(0.4))
    }

    private var volumeHeaderBar: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(vm.titleName)
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Text("ID: \(vm.titleID) · \(vm.totalFiles) \(l10n.filesCountLabel) · \(ByteCountFormatter.string(fromByteCount: Int64(vm.totalBytes), countStyle: .file))")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
                Spacer()
                Toggle("Patch .XBE", isOn: $vm.patchXbe)
                    .labelsHidden()
                    .tint(.green)
            }
            TextField(l10n.searchFilesPlaceholder, text: $vm.searchQuery)
                .textFieldStyle(.roundedBorder)
        }
        .padding(12)
        .background(cardBg)
    }

    private var breadcrumbBar: some View {
        HStack {
            if vm.currentDirectory != "/" {
                Button {
                    let comps = vm.currentDirectory.split(separator: "/")
                    if comps.count <= 1 {
                        vm.currentDirectory = "/"
                    } else {
                        vm.currentDirectory = "/" + comps.dropLast().joined(separator: "/")
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                        Text(l10n.backButton)
                    }
                    .font(.caption.bold())
                    .foregroundColor(.green)
                }
            }
            Text(vm.currentDirectory)
                .font(.caption.monospaced())
                .foregroundColor(.gray)
                .lineLimit(1)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var fileListView: some View {
        List(vm.visibleItems) { item in
            HStack(spacing: 12) {
                Image(
                    systemName: item.isDirectory
                        ? "folder.fill"
                        : (item.name.lowercased().hasSuffix(".xbe") || item.name.lowercased().hasSuffix(".xex")
                            ? "terminal.fill"
                            : "doc.fill")
                )
                .foregroundColor(item.isDirectory ? .green : .secondary)
                .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(.white)
                    Text(
                        item.isDirectory
                            ? "\(l10n.folderLabel) · \(l10n.sectorLabel) \(item.startSector)"
                            : "\(ByteCountFormatter.string(fromByteCount: Int64(item.sizeBytes), countStyle: .file)) · \(l10n.sectorLabel) \(item.startSector)"
                    )
                    .font(.caption2.monospaced())
                    .foregroundColor(.gray)
                }
                Spacer()

                if item.isDirectory {
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.gray)
                } else {
                    Button {
                        vm.extractSingle(item)
                    } label: {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.title3)
                            .foregroundColor(.green)
                    }
                    .buttonStyle(.plain)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if item.isDirectory {
                    vm.currentDirectory = item.path
                } else {
                    vm.extractSingle(item)
                }
            }
            .listRowBackground(cardBg)
        }
        .listStyle(.plain)
    }

    private var bottomToolbar: some View {
        VStack(spacing: 8) {
            if !vm.statusMessage.isEmpty {
                HStack {
                    Text(vm.statusMessage)
                        .font(.caption)
                        .foregroundColor(.gray)
                        .lineLimit(1)
                    Spacer()
                    if vm.exportURL != nil {
                        Button(l10n.saveToFilesButton) {
                            vm.showExportPicker = true
                        }
                        .font(.caption.bold())
                        .foregroundColor(.green)
                    }
                }
            }
            HStack(spacing: 10) {
                Button {
                    vm.extractAllToFolder()
                } label: {
                    HStack {
                        if vm.isExtracting {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "square.and.arrow.down.on.square.fill")
                        }
                        Text(l10n.extractAllButton)
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(xboxGreen)
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .disabled(vm.isExtracting)

                if vm.exportURL != nil && !vm.isExtracting {
                    Button {
                        vm.showShareSheet = true
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .font(.headline)
                            .padding(.vertical, 14)
                            .padding(.horizontal, 16)
                            .background(Color.white.opacity(0.1))
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                }
            }
        }
        .padding(12)
        .background(cardBg)
    }
}
