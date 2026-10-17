// Scripture pack v0 — small, high-confidence starter set.
// Every entry MUST include Arabic, Indonesian, English, exact source, and (for hadith) grading.
// User to review this file before expanding to v1.
//
// Translations credited inline. Qur'an ID follows Kemenag RI; EN follows Sahih International.
// Hadith translations are rendered in modern readable form; grading from classical/accepted authorities.

export const scripture = [
  // === QUR'AN ===
  {
    type: "ayat",
    ar: "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ",
    id: "Bacalah dengan (menyebut) nama Tuhanmu yang menciptakan.",
    en: "Read, in the name of your Lord who created.",
    source: { ref: "QS. Al-'Alaq: 1", ar: "سورة العلق", id: "Al-'Alaq 1", en: "Al-'Alaq 1" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
    id: "Dan katakanlah, \"Ya Tuhanku, tambahkanlah ilmu kepadaku.\"",
    en: "And say: My Lord, increase me in knowledge.",
    source: { ref: "QS. Thaha: 114", ar: "سورة طه", id: "Thaha 114", en: "Taha 114" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",
    id: "Allah akan mengangkat (derajat) orang-orang yang beriman di antaramu dan orang-orang yang diberi ilmu beberapa derajat.",
    en: "Allah will raise those who have believed among you and those who were given knowledge, by degrees.",
    source: { ref: "QS. Al-Mujadilah: 11", ar: "سورة المجادلة", id: "Al-Mujadilah 11", en: "Al-Mujadilah 11" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    id: "Maka sesungguhnya bersama kesulitan ada kemudahan. Sesungguhnya bersama kesulitan ada kemudahan.",
    en: "For indeed, with hardship comes ease. Indeed, with hardship comes ease.",
    source: { ref: "QS. Al-Insyirah: 5-6", ar: "سورة الشرح", id: "Al-Insyirah 5-6", en: "Ash-Sharh 5-6" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا",
    id: "Dan orang-orang yang berjihad (bersungguh-sungguh) untuk (mencari keridaan) Kami, benar-benar akan Kami tunjukkan kepada mereka jalan-jalan Kami.",
    en: "And those who strive for Us — We will surely guide them to Our ways.",
    source: { ref: "QS. Al-'Ankabut: 69", ar: "سورة العنكبوت", id: "Al-'Ankabut 69", en: "Al-'Ankabut 69" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
    id: "Allah tidak membebani seseorang melainkan sesuai dengan kesanggupannya.",
    en: "Allah does not burden a soul beyond what it can bear.",
    source: { ref: "QS. Al-Baqarah: 286", ar: "سورة البقرة", id: "Al-Baqarah 286", en: "Al-Baqarah 286" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ",
    id: "Dan bahwa manusia hanya memperoleh apa yang telah diusahakannya.",
    en: "And that man shall have nothing but what he strives for.",
    source: { ref: "QS. An-Najm: 39", ar: "سورة النجم", id: "An-Najm 39", en: "An-Najm 39" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },
  {
    type: "ayat",
    ar: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
    id: "Dan barang siapa bertawakal kepada Allah, niscaya Allah akan mencukupkan (keperluan)nya.",
    en: "And whoever relies upon Allah — then He is sufficient for him.",
    source: { ref: "QS. At-Talaq: 3", ar: "سورة الطلاق", id: "At-Talaq 3", en: "At-Talaq 3" },
    credits: { id: "Kemenag RI", en: "Sahih International" }
  },

  // === HADITH ===
  {
    type: "hadith",
    ar: "مَنْ يُرِدِ اللَّهُ بِهِ خَيْرًا يُفَقِّهْهُ فِي الدِّينِ",
    id: "Barang siapa yang Allah kehendaki kebaikan baginya, Allah akan menjadikannya paham tentang agama.",
    en: "Whoever Allah intends good for, He grants him understanding of the religion.",
    source: { ref: "HR. Bukhari no. 71 & Muslim no. 1037", id: "Shahih Bukhari no. 71 · Shahih Muslim no. 1037", en: "Sahih al-Bukhari 71 · Sahih Muslim 1037" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    id: "Barang siapa menempuh suatu jalan untuk mencari ilmu, Allah akan memudahkan baginya jalan menuju surga.",
    en: "Whoever takes a path in search of knowledge, Allah will make easy for him a path to Paradise.",
    source: { ref: "HR. Muslim no. 2699", id: "Shahih Muslim no. 2699", en: "Sahih Muslim 2699" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ",
    id: "Amalan yang paling dicintai Allah adalah yang paling kontinu, walaupun sedikit.",
    en: "The deeds most beloved to Allah are the most consistent, even if small.",
    source: { ref: "HR. Bukhari no. 6464 & Muslim no. 2818", id: "Shahih Bukhari no. 6464 · Shahih Muslim no. 2818", en: "Sahih al-Bukhari 6464 · Sahih Muslim 2818" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "احْرِصْ عَلَى مَا يَنْفَعُكَ وَاسْتَعِنْ بِاللَّهِ وَلَا تَعْجَزْ",
    id: "Bersungguh-sungguhlah pada hal yang bermanfaat bagimu, mohonlah pertolongan kepada Allah, dan jangan merasa lemah.",
    en: "Strive for what benefits you, seek help from Allah, and do not give in to weakness.",
    source: { ref: "HR. Muslim no. 2664", id: "Shahih Muslim no. 2664", en: "Sahih Muslim 2664" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "إِنَّ الدِّينَ يُسْرٌ",
    id: "Sesungguhnya agama ini mudah.",
    en: "Indeed, this religion is easy.",
    source: { ref: "HR. Bukhari no. 39", id: "Shahih Bukhari no. 39", en: "Sahih al-Bukhari 39" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    id: "Sebaik-baik kalian adalah yang mempelajari Al-Qur'an dan mengajarkannya.",
    en: "The best among you is the one who learns the Qur'an and teaches it.",
    source: { ref: "HR. Bukhari no. 5027", id: "Shahih Bukhari no. 5027", en: "Sahih al-Bukhari 5027" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ",
    id: "Barang siapa menunjukkan kepada kebaikan, baginya pahala seperti pahala pelakunya.",
    en: "Whoever points to goodness receives a reward like the one who does it.",
    source: { ref: "HR. Muslim no. 1893", id: "Shahih Muslim no. 1893", en: "Sahih Muslim 1893" },
    grading: "sahih"
  },
  {
    type: "hadith",
    ar: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ",
    id: "Sesungguhnya setiap amalan tergantung pada niatnya.",
    en: "Deeds are judged by intentions.",
    source: { ref: "HR. Bukhari no. 1 & Muslim no. 1907", id: "Shahih Bukhari no. 1 · Shahih Muslim no. 1907", en: "Sahih al-Bukhari 1 · Sahih Muslim 1907" },
    grading: "sahih"
  }
];
