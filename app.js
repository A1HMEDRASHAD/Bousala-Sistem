import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. إعدادات Firebase الخاصة بشبكة البوصلة
const firebaseConfig = {
  apiKey: "AIzaSyAd4Df_Fpp2GlGkRPyvmKuFW68LbL_a4yU",
  authDomain: "rawi-01.firebaseapp.com",
  projectId: "rawi-01",
  storageBucket: "rawi-01.firebasestorage.app",
  messagingSenderId: "91203142966",
  appId: "1:91203142966:web:a44f7c06c98529a57a9f97",
  measurementId: "G-2VNWNSZLBJ"
};

// 2. الثوابت السيادية ومفتاح ImgBB والشعارات الافتراضية
const SOVEREIGN_ADMINS = [
  "a1hmedrashad@gmail.com",
  "rawialshamal@gmail.com"
];
const IMGBB_API_KEY = "739d843d86f97bcc98efd51fba08f5d8";
const DEFAULT_LOGO = "https://i.ibb.co/BHHHLttP/image.png";
const DEFAULT_FAVICON = "https://i.ibb.co/WWSTnMgd/image.jpg";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// متغيرات حالة النظام والصلاحيات
let currentUser = null;
let currentRole = null; // 'super_admin' | 'editor' | 'writer'
let currentStaffName = "";
let allowedCategories = []; // الأقسام المسموحة للمحرر فقط
let selectedStaffCategories = new Set(); // لاختيار أقسام الموظف بالنقر المباشر

let allPosts = [];
let allCategories = [];
let allAds = [];
let allStaff = [];

let globalSettings = {
  siteName: "بوصلة السياسة اليمنية",
  siteNameEn: "Yemeni Politics Compass",
  networkName: "شبكة البوصلة",
  networkNameEn: "Al-Bosla Network",
  siteDesc: "منصة إخبارية وتحليلية ترصد كواليس السياسة والتقنية والثقافة بعمق ومصداقية",
  publicUrl: "",
  logoUrl: DEFAULT_LOGO,
  faviconUrl: DEFAULT_FAVICON,
  hideTextLogo: true,
  accentColor: "#3b82f6",
  showAboutMenu: true,
  aboutContent: "",
  aboutContentEn: "",
  privacyContent: "",
  contactEmail: "A1HMEDRASHAD@GMAIL.COM",
  contactPhone: "",
  adsEnabled: false,
  adsenseId: "",
  adSlot: "",
  customAdText: "",
  customAdLink: "",
  socialWhatsapp: "",
  socialFacebook: "",
  socialX: "",
  socialTelegram: "",
  autoTgEnabled: false,
  tgBotToken: "",
  tgChatId: "",
  autoFbEnabled: false,
  fbPageId: "",
  fbAccessToken: "",
  autoXEnabled: false,
  xApiKey: "",
  xWebhookUrl: ""
};

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app-shell");
const loginError = document.getElementById("login-error");
const toastEl = document.getElementById("toast");

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.background = isError ? "#ef4444" : "#10b981";
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3500);
}

// 3. إدارة الوضع الليلي والنهاري في غرفة العمليات
function initAdminTheme() {
  const saved = localStorage.getItem("bosla_admin_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const icon = document.getElementById("admin-theme-icon");
  if (icon) icon.textContent = saved === "dark" ? "light_mode" : "dark_mode";
}

document.getElementById("admin-theme-toggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("bosla_admin_theme", next);
  document.getElementById("admin-theme-icon").textContent = next === "dark" ? "light_mode" : "dark_mode";
});

initAdminTheme();

// 4. أنيميشن الكبسولة المنزلقة (Morphing Pill Animation) في شريط التنقل السفلي
function updateNavPillIndicator() {
  const activeBtn = document.querySelector("#admin-bottom-nav .nav-item.active");
  const indicator = document.getElementById("nav-pill-indicator");
  if (!activeBtn || !indicator || activeBtn.classList.contains("hidden")) return;

  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
}

window.addEventListener("resize", updateNavPillIndicator);

document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.target));
});

document.getElementById("quick-new-post-btn").addEventListener("click", () => {
  resetPostForm();
  switchTab("tab-editor");
});

function switchTab(tabId) {
  document.querySelectorAll(".tab-view").forEach(sec => sec.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId)?.classList.add("active");
  const targetBtn = document.querySelector(`.nav-item[data-target="${tabId}"]`);
  if (targetBtn) targetBtn.classList.add("active");
  updateNavPillIndicator();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 5. تسجيل الدخول وفحص الصلاحيات السيادية وعزل الموظفين
document.getElementById("google-login-btn").addEventListener("click", async () => {
  loginError.classList.add("hidden");
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    loginError.textContent = "تعذر تسجيل الدخول: " + err.message;
    loginError.classList.remove("hidden");
  }
});

document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
    return;
  }

  const email = (user.email || "").toLowerCase().trim();

  if (SOVEREIGN_ADMINS.includes(email)) {
    currentUser = user;
    currentRole = "super_admin";
    currentStaffName = user.displayName || "القيادة السيادية";
    allowedCategories = [];
    await initDashboard();
    return;
  }

  try {
    const staffSnap = await getDoc(doc(db, "staff", email));
    if (staffSnap.exists() && staffSnap.data().active !== false) {
      const data = staffSnap.data();
      currentUser = user;
      currentRole = data.role || "writer";
      currentStaffName = data.name || user.displayName || "محرر البوصلة";
      allowedCategories = Array.isArray(data.categories) ? data.categories : [];
      await initDashboard();
    } else {
      await signOut(auth);
      loginError.textContent = `الحساب (${email}) غير مصرح له بدخول غرفة العمليات.`;
      loginError.classList.remove("hidden");
    }
  } catch (err) {
    loginError.textContent = "خطأ في فحص الصلاحيات: " + err.message;
    loginError.classList.remove("hidden");
  }
});

async function initDashboard() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  const badge = document.getElementById("user-role-badge");
  const postsHeading = document.getElementById("posts-view-heading");
  const postsSub = document.getElementById("posts-view-sub");
  const statTotalLabel = document.getElementById("stat-total-label");
  const authorInput = document.getElementById("post-author");

  if (currentRole === "super_admin") {
    badge.textContent = "قيادة سيادية مطلقة";
    postsHeading.textContent = "إدارة جميع منشورات الشبكة";
    postsSub.textContent = "رؤية شاملة وتحكم كامل بجميع مقالات الفريق، الاعتماد، التقييد، أو الحذف";
    statTotalLabel.textContent = "إجمالي مقالات الشبكة";
    authorInput.readOnly = false;
    document.querySelectorAll(".super-only").forEach(el => el.classList.remove("hidden"));
  } else {
    badge.textContent = currentRole === "editor" ? `محرر معتمد (${currentStaffName})` : `كاتب مسودات (${currentStaffName})`;
    postsHeading.textContent = "منشوراتي الخاصة";
    postsSub.textContent = "تظهر هنا مقالاتك التي كتبتها فقط لتعديلها ومتابعتها ضمن الأقسام المخصصة لك";
    statTotalLabel.textContent = "إجمالي مقالاتي";
    authorInput.value = currentStaffName;
    document.querySelectorAll(".super-only").forEach(el => el.classList.add("hidden"));
  }

  authorInput.value = currentStaffName;

  await loadGlobalSettings();
  await loadCategories();
  await loadPosts();
  if (currentRole === "super_admin") {
    await loadAds();
    await loadStaff();
  }

  setTimeout(updateNavPillIndicator, 120);
}

// 6. محرك ضغط ورفع الصور إلى ImgBB
function compressImageFile(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const dataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

async function uploadToImgBB(file, maxWidth = 1200) {
  const base64Image = await compressImageFile(file, maxWidth);
  const formData = new FormData();
  formData.append("image", base64Image);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "فشل الرفع إلى ImgBB");
  return json.data.display_url;
}

function showImagePreview(wrapId, imgId, url) {
  const wrap = document.getElementById(wrapId);
  const img = document.getElementById(imgId);
  if (url) {
    img.src = url;
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

document.getElementById("trigger-upload-btn").addEventListener("click", () => {
  document.getElementById("post-image-file").click();
});

document.getElementById("post-image-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusText = document.getElementById("upload-status-text");
  statusText.textContent = "جاري ضغط ورفع الصورة...";
  try {
    const url = await uploadToImgBB(file, 1200);
    document.getElementById("post-image-url").value = url;
    showImagePreview("image-preview-wrap", "post-image-preview", url);
    statusText.textContent = "تم الرفع بنجاح ✓";
    showToast("تم رفع الصورة بنجاح");
  } catch (err) {
    statusText.textContent = "تعذر رفع الصورة";
    showToast("خطأ في رفع الصورة: " + err.message, true);
  }
});

document.getElementById("post-image-url").addEventListener("input", (e) => {
  showImagePreview("image-preview-wrap", "post-image-preview", e.target.value.trim());
});

// 7. التحكم بنوع المادة (فيديو / بودكاست / مقال) وأدوات المحرر الشبيه بالوورد
const postTypeSelect = document.getElementById("post-type");
const mediaVideoBox = document.getElementById("media-video-box");
const mediaPodcastBox = document.getElementById("media-podcast-box");

postTypeSelect.addEventListener("change", () => {
  const type = postTypeSelect.value;
  mediaVideoBox.classList.toggle("hidden", type !== "video" && type !== "infographic");
  mediaPodcastBox.classList.toggle("hidden", type !== "podcast");
});

document.querySelectorAll(".word-toolbar .tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const textarea = document.getElementById("post-content");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);

    let replacement = "";
    switch (action) {
      case "h2":
        replacement = `\n## ${selected || "عنوان رئيسي للفقرة"}\n`;
        break;
      case "h3":
        replacement = `\n### ${selected || "عنوان فرعي"}\n`;
        break;
      case "bold":
        replacement = `**${selected || "نص عريض"}**`;
        break;
      case "italic":
        replacement = `*${selected || "نص مائل"}*`;
        break;
      case "underline":
        replacement = `<u>${selected || "نص تحته خط"}</u>`;
        break;
      case "highlight":
        replacement = `<mark>${selected || "نص مميز"}</mark>`;
        break;
      case "quote":
        replacement = `\n> ${selected || "اقتباس صحفي بارز"}\n`;
        break;
      case "ul":
        replacement = `\n- ${selected || "نقطة مهمة في القائمة"}\n`;
        break;
      case "ol":
        replacement = `\n1. ${selected || "عنصر مرقم في القائمة"}\n`;
        break;
      case "divider":
        replacement = `\n---\n`;
        break;
      case "link": {
        const url = prompt("أدخل الرابط الخارجي (URL):", "https://");
        if (!url) return;
        replacement = `[${selected || "اضغط هنا"}](${url})`;
        break;
      }
      case "paragraph":
        replacement = `\n\n${selected || "اكتب الفقرة الجديدة هنا..."}\n\n`;
        break;
    }

    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    textarea.focus();
    updateLivePreview();
  });
});

const previewBox = document.getElementById("live-content-preview");
document.getElementById("toggle-preview-btn").addEventListener("click", () => {
  previewBox.classList.toggle("hidden");
  updateLivePreview();
});

document.getElementById("post-content").addEventListener("input", () => {
  if (!previewBox.classList.contains("hidden")) updateLivePreview();
});

function renderRichTextToHtml(raw) {
  return (raw || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line === "---") return `<hr class="divider">`;
      let formatted = line
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--accent);font-weight:700;">$1</a>');
      if (formatted.startsWith("### ")) return `<h3>${formatted.replace("### ", "")}</h3>`;
      if (formatted.startsWith("## ")) return `<h2>${formatted.replace("## ", "")}</h2>`;
      if (formatted.startsWith("> ")) return `<blockquote>${formatted.replace("> ", "")}</blockquote>`;
      if (formatted.startsWith("- ")) return `<p>• ${formatted.replace("- ", "")}</p>`;
      return `<p>${formatted}</p>`;
    })
    .join("");
}

function updateLivePreview() {
  const raw = document.getElementById("post-content").value;
  previewBox.innerHTML = renderRichTextToHtml(raw) || `<span class="status-hint">اكتب في صندوق المتن لرؤية المعاينة الحية...</span>`;
}

// 8. إدارة المنشورات مع العزل الصارم لصلاحيات الموظفين
async function loadPosts() {
  const listEl = document.getElementById("posts-list");
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // عزل صارم: إذا لم يكن المستخدم مالكاً سيادياً، لا يرى إلا منشوراته التي كتبها بنفسه
    if (currentRole === "super_admin") {
      allPosts = fetched;
    } else {
      const myEmail = currentUser.email.toLowerCase().trim();
      allPosts = fetched.filter(p => (p.authorEmail || "").toLowerCase().trim() === myEmail);
    }

    updatePostStats();
    renderPosts();
  } catch (err) {
    listEl.innerHTML = `<div class="glass-card">تعذر جلب المنشورات: ${err.message}</div>`;
  }
}

function updatePostStats() {
  document.getElementById("stat-total").textContent = allPosts.length;
  document.getElementById("stat-published").textContent = allPosts.filter(p => p.status === "published").length;
  document.getElementById("stat-drafts").textContent = allPosts.filter(p => p.status !== "published").length;
}

let activeFilter = "all";
document.querySelectorAll(".filter-pills .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".filter-pills .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    activeFilter = pill.dataset.filter;
    renderPosts();
  });
});

document.getElementById("search-posts-input").addEventListener("input", renderPosts);

function renderPosts() {
  const listEl = document.getElementById("posts-list");
  const searchTerm = document.getElementById("search-posts-input").value.toLowerCase().trim();

  const filtered = allPosts.filter(post => {
    if (activeFilter !== "all" && post.status !== activeFilter) return false;
    if (searchTerm) {
      const inTitle = (post.title || "").toLowerCase().includes(searchTerm);
      const inSummary = (post.summary || "").toLowerCase().includes(searchTerm);
      const inAuthor = (post.author || "").toLowerCase().includes(searchTerm);
      const inTags = (post.tags || []).some(t => t.toLowerCase().includes(searchTerm));
      return inTitle || inSummary || inAuthor || inTags;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد منشورات مطابقة حالياً</div>`;
    return;
  }

  const typeLabels = {
    article: "📰 مقال",
    video: "🎬 فيديو",
    infographic: "📊 فيديو جرافيك",
    podcast: "🎙️ بودكاست",
    photos: "📷 صور"
  };

  listEl.innerHTML = filtered.map(post => {
    const statusLabel = post.status === "published" ? "منشور" : post.status === "restricted" ? "مقيّد" : "مسودة";
    const statusClass = post.status === "published" ? "status-published" : post.status === "restricted" ? "status-restricted" : "status-draft";
    const thumb = post.imageUrl || globalSettings.logoUrl || DEFAULT_LOGO;
    const typeBadge = typeLabels[post.postType || "article"] || "📰 مقال";

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="صورة" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${statusClass}">${statusLabel}</span>
              <span class="status-badge cat-badge">${post.categoryName || post.category || "عام"}</span>
              <span class="status-badge cat-badge">${typeBadge}</span>
              ${post.titleEn ? `<span class="status-badge status-published">EN مترجم</span>` : ""}
              ${post.isBreaking ? `<span class="status-badge status-restricted">عاجل</span>` : ""}
            </div>
            <h3>${post.title}</h3>
            <div class="post-submeta">الكاتب: ${post.author || "هيئة التحرير"} • المشاهدات: ${post.views || 0}</div>
          </div>
        </div>
        <div class="post-actions-bar">
          <button class="action-chip chip-smart" onclick="window.smartCopyPost('${post.id}')">
            <span class="material-symbols-rounded">content_copy</span>
            <span>النسخ الذكي</span>
          </button>
          <button class="action-chip" onclick="window.editPost('${post.id}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          ${currentRole === "super_admin" ? `
          <button class="action-chip" onclick="window.toggleRestrictPost('${post.id}')">
            <span class="material-symbols-rounded">${post.status === "published" ? "visibility_off" : "publish"}</span>
            <span>${post.status === "published" ? "تقييد" : "اعتماد ونشر"}</span>
          </button>
          <button class="action-chip chip-danger" onclick="window.deletePost('${post.id}')">
            <span class="material-symbols-rounded">delete_forever</span>
            <span>حذف</span>
          </button>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

document.getElementById("post-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const desiredStatus = currentRole === "writer" ? "draft" : "published";
  await savePostToFirestore(desiredStatus);
});

document.getElementById("save-draft-btn").addEventListener("click", async () => {
  await savePostToFirestore("draft");
});

async function savePostToFirestore(status) {
  const postId = document.getElementById("post-id").value;
  const catSelect = document.getElementById("post-category");
  const categorySlug = catSelect.value;
  const catObj = allCategories.find(c => c.slug === categorySlug);
  const categoryName = catObj?.name || catSelect.options[catSelect.selectedIndex]?.textContent || "";

  if (!categorySlug) {
    showToast("يرجى اختيار القسم الرئيسي أولاً", true);
    return;
  }

  // تحقق أمني إضافي: منع المحرر من النشر في قسم غير مخصص له
  if (currentRole !== "super_admin" && allowedCategories.length > 0 && !allowedCategories.includes(categorySlug)) {
    showToast("غير مصرح لك بالنشر في هذا القسم!", true);
    return;
  }

  // إذا كان محرراً يحاول تعديل منشور، نتأكد أنه صاحب المنشور حصراً
  if (postId && currentRole !== "super_admin") {
    const existing = allPosts.find(p => p.id === postId);
    if (!existing || (existing.authorEmail || "").toLowerCase() !== currentUser.email.toLowerCase()) {
      showToast("لا يمكنك تعديل مقال لا يخصك!", true);
      return;
    }
  }

  const tagsRaw = document.getElementById("post-tags").value;
  const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

  const payload = {
    postType: document.getElementById("post-type").value || "article",
    title: document.getElementById("post-title").value.trim(),
    summary: document.getElementById("post-summary").value.trim(),
    content: document.getElementById("post-content").value.trim(),
    titleEn: document.getElementById("post-title-en").value.trim(),
    summaryEn: document.getElementById("post-summary-en").value.trim(),
    contentEn: document.getElementById("post-content-en").value.trim(),
    videoUrl: document.getElementById("post-video-url").value.trim(),
    podcastPlatform: document.getElementById("post-podcast-platform").value,
    podcastUrl: document.getElementById("post-podcast-url").value.trim(),
    podcastDuration: document.getElementById("post-podcast-duration").value.trim(),
    category: categorySlug,
    categoryName: categoryName,
    categoryNameEn: catObj?.nameEn || "",
    subcategory: document.getElementById("post-subcategory").value,
    author: document.getElementById("post-author").value.trim(),
    sourceUrl: document.getElementById("post-source-url").value.trim(),
    imageUrl: document.getElementById("post-image-url").value.trim(),
    tags: tags,
    isBreaking: document.getElementById("post-is-breaking").checked,
    isFeatured: document.getElementById("post-is-featured").checked,
    status: status,
    updatedAt: serverTimestamp()
  };

  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), payload);
      showToast("تم تحديث المادة الصحفية بنجاح");
    } else {
      payload.authorEmail = currentUser.email.toLowerCase().trim();
      payload.createdAt = serverTimestamp();
      payload.views = 0;
      const docRef = await addDoc(collection(db, "posts"), payload);
      if (status === "published") {
        await triggerAutoSocialPublish({ id: docRef.id, ...payload });
      }
      showToast(status === "published" ? "تم النشر في الموقع بنجاح!" : "تم حفظ المسودة بنجاح");
    }
    resetPostForm();
    await loadPosts();
    switchTab("tab-posts");
  } catch (err) {
    showToast("خطأ أثناء حفظ المقال: " + err.message, true);
  }
}

function resetPostForm() {
  document.getElementById("post-form").reset();
  document.getElementById("post-id").value = "";
  document.getElementById("post-type").value = "article";
  mediaVideoBox.classList.add("hidden");
  mediaPodcastBox.classList.add("hidden");
  previewBox.classList.add("hidden");
  document.getElementById("editor-heading").textContent = "نشر مادة صحفية";
  document.getElementById("cancel-edit-btn").classList.add("hidden");
  showImagePreview("image-preview-wrap", "post-image-preview", "");
  document.getElementById("post-author").value = currentStaffName || currentUser?.displayName || "هيئة التحرير";
}

document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  resetPostForm();
  switchTab("tab-posts");
});

window.editPost = (id) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  if (currentRole !== "super_admin" && (post.authorEmail || "").toLowerCase() !== currentUser.email.toLowerCase()) {
    showToast("عذراً، يمكنك تعديل مقالاتك الخاصة فقط.", true);
    return;
  }

  document.getElementById("post-id").value = post.id;
  document.getElementById("post-type").value = post.postType || "article";
  postTypeSelect.dispatchEvent(new Event("change"));

  document.getElementById("post-title").value = post.title || "";
  document.getElementById("post-summary").value = post.summary || "";
  document.getElementById("post-content").value = post.content || "";

  document.getElementById("post-title-en").value = post.titleEn || "";
  document.getElementById("post-summary-en").value = post.summaryEn || "";
  document.getElementById("post-content-en").value = post.contentEn || "";

  document.getElementById("post-video-url").value = post.videoUrl || "";
  document.getElementById("post-podcast-platform").value = post.podcastPlatform || "Spotify";
  document.getElementById("post-podcast-url").value = post.podcastUrl || "";
  document.getElementById("post-podcast-duration").value = post.podcastDuration || "";

  document.getElementById("post-category").value = post.category || "";
  populateSubcategories(post.category, post.subcategory);
  document.getElementById("post-author").value = post.author || "";
  document.getElementById("post-source-url").value = post.sourceUrl || "";
  document.getElementById("post-image-url").value = post.imageUrl || "";
  showImagePreview("image-preview-wrap", "post-image-preview", post.imageUrl || "");
  document.getElementById("post-tags").value = (post.tags || []).join(", ");
  document.getElementById("post-is-breaking").checked = !!post.isBreaking;
  document.getElementById("post-is-featured").checked = !!post.isFeatured;

  document.getElementById("editor-heading").textContent = "تعديل المادة الصحفية";
  document.getElementById("cancel-edit-btn").classList.remove("hidden");
  switchTab("tab-editor");
};

window.toggleRestrictPost = async (id) => {
  if (currentRole !== "super_admin") return;
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  const newStatus = post.status === "published" ? "restricted" : "published";
  try {
    await updateDoc(doc(db, "posts", id), { status: newStatus, updatedAt: serverTimestamp() });
    showToast(newStatus === "published" ? "تم اعتماد ونشر المقال" : "تم تقييد المقال وإخفاؤه");
    await loadPosts();
  } catch (err) {
    showToast("تعذر تحديث الحالة: " + err.message, true);
  }
};

window.deletePost = async (id) => {
  if (currentRole !== "super_admin") return;
  if (!confirm("تأكيد الحذف النهائي للمقال؟")) return;
  try {
    await deleteDoc(doc(db, "posts", id));
    showToast("تم حذف المقال نهائياً");
    await loadPosts();
  } catch (err) {
    showToast("فشل الحذف: " + err.message, true);
  }
};

window.smartCopyPost = async (id) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  const baseUrl = (globalSettings.publicUrl || window.location.origin).replace(/\/$/, "");
  const articleUrl = `${baseUrl}/?post=${post.id}`;
  const hashtags = (post.tags || []).map(t => `#${t.replace(/\s+/g, "_")}`).join(" ");

  let socialBlock = [];
  if (globalSettings.socialWhatsapp) socialBlock.push(`🟢 واتساب: ${globalSettings.socialWhatsapp}`);
  if (globalSettings.socialTelegram) socialBlock.push(`🔵 تيليجرام: ${globalSettings.socialTelegram}`);
  if (globalSettings.socialX) socialBlock.push(`⚫ إكس: ${globalSettings.socialX}`);
  if (globalSettings.socialFacebook) socialBlock.push(`🔷 فيسبوك: ${globalSettings.socialFacebook}`);

  const formattedText = [
    `🧭 ${globalSettings.siteName} | ${post.categoryName || ""}`,
    `━━━━━━━━━━━━━━`,
    `📌 ${post.title}`,
    ``,
    `${post.summary}`,
    ``,
    `📖 التفاصيل الكاملة عبر ${globalSettings.networkName}:`,
    `${articleUrl}`,
    socialBlock.length ? `\n━━━━━━━━━━━━━━\n${socialBlock.join("\n")}` : "",
    hashtags ? `\n${hashtags}` : ""
  ].filter(Boolean).join("\n");

  try {
    await navigator.clipboard.writeText(formattedText);
    showToast("تم نسخ الحزمة الذكية! جاهزة للصق في المنصات");
  } catch (err) {
    showToast("تعذر النسخ التلقائي", true);
  }
};

// 9. نظام إدارة الرعايات والإعلانات الممولة (يدعم البانر الأفقي الممتد Leaderboard + الشريط الزجاجي)
document.getElementById("trigger-ad-upload-btn").addEventListener("click", () => {
  document.getElementById("ad-image-file").click();
});

document.getElementById("ad-image-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("ad-upload-status");
  statusEl.textContent = "جاري رفع صورة البانر / الإعلان...";
  try {
    const url = await uploadToImgBB(file, 1400);
    document.getElementById("ad-image-url").value = url;
    showImagePreview("ad-preview-wrap", "ad-image-preview", url);
    statusEl.textContent = "تم رفع صورة الإعلان ✓";
    showToast("تم رفع صورة الإعلان بنجاح");
  } catch (err) {
    statusEl.textContent = "فشل رفع الصورة";
    showToast("خطأ في رفع صورة الإعلان: " + err.message, true);
  }
});

document.getElementById("ad-image-url").addEventListener("input", (e) => {
  showImagePreview("ad-preview-wrap", "ad-image-preview", e.target.value.trim());
});

async function loadAds() {
  const listEl = document.getElementById("ads-list");
  try {
    const snap = await getDocs(collection(db, "ads"));
    allAds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    updateAdStats();
    renderAdsList();
  } catch (err) {
    listEl.innerHTML = `<div class="glass-card">تعذر جلب الإعلانات: ${err.message}</div>`;
  }
}

function updateAdStats() {
  const activeCount = allAds.filter(a => a.active !== false).length;
  const totalViews = allAds.reduce((sum, a) => sum + (a.views || 0), 0);
  const totalClicks = allAds.reduce((sum, a) => sum + (a.clicks || 0), 0);

  document.getElementById("stat-ads-active").textContent = activeCount;
  document.getElementById("stat-ads-views").textContent = totalViews;
  document.getElementById("stat-ads-clicks").textContent = totalClicks;
}

function renderAdsList() {
  const listEl = document.getElementById("ads-list");
  if (allAds.length === 0) {
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد حملات إعلانية مضافة حالياً.</div>`;
    return;
  }

  const placementNames = {
    all: "جميع المواضع",
    top: "أعلى الرئيسية",
    between_posts: "بين الأخبار",
    in_article: "وسط المقالات"
  };

  listEl.innerHTML = allAds.map(ad => {
    const isActive = ad.active !== false;
    const views = ad.views || 0;
    const clicks = ad.clicks || 0;
    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) : "0.0";
    const thumb = ad.imageUrl || globalSettings.logoUrl || DEFAULT_LOGO;
    const styleBadge = ad.adStyle === "banner" ? "🖼️ بانر أفقي ممتد" : "✨ بطاقة رعاية زجاجية";

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="${ad.sponsorName}" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${isActive ? "status-published" : "status-restricted"}">${isActive ? "إعلان نشط" : "متوقف مؤقتاً"}</span>
              <span class="status-badge cat-badge">${styleBadge}</span>
              <span class="status-badge cat-badge">${placementNames[ad.placement] || "جميع المواضع"}</span>
            </div>
            <h3>${ad.title}</h3>
            <div class="post-submeta">الراعي: <strong>${ad.sponsorName}</strong> • <a href="${ad.targetUrl}" target="_blank" style="color:var(--accent)">معاينة الرابط</a></div>
            <div class="ad-metrics-bar">
              <span class="metric-pill views">👁️ الظهور: ${views}</span>
              <span class="metric-pill clicks">🖱️ النقرات: ${clicks}</span>
              <span class="metric-pill ctr">📈 التفاعل CTR: ${ctr}%</span>
            </div>
          </div>
        </div>
        <div class="post-actions-bar">
          <button class="action-chip" onclick="window.toggleAdStatus('${ad.id}')">
            <span class="material-symbols-rounded">${isActive ? "pause_circle" : "play_circle"}</span>
            <span>${isActive ? "إيقاف مؤقت" : "تفعيل الإعلان"}</span>
          </button>
          <button class="action-chip" onclick="window.editAd('${ad.id}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          <button class="action-chip" onclick="window.resetAdStats('${ad.id}')">
            <span class="material-symbols-rounded">restart_alt</span>
            <span>تصفير العداد</span>
          </button>
          <button class="action-chip chip-danger" onclick="window.deleteAd('${ad.id}')">
            <span class="material-symbols-rounded">delete</span>
            <span>حذف</span>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

document.getElementById("ad-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const adId = document.getElementById("ad-id").value;

  const payload = {
    adStyle: document.getElementById("ad-style").value || "banner",
    sponsorName: document.getElementById("ad-sponsor").value.trim(),
    title: document.getElementById("ad-title").value.trim(),
    targetUrl: document.getElementById("ad-target-url").value.trim(),
    placement: document.getElementById("ad-placement").value,
    imageUrl: document.getElementById("ad-image-url").value.trim(),
    active: document.getElementById("ad-active").checked,
    updatedAt: serverTimestamp()
  };

  try {
    if (adId) {
      await updateDoc(doc(db, "ads", adId), payload);
      showToast("تم تحديث الحملة الإعلانية بنجاح");
    } else {
      payload.views = 0;
      payload.clicks = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "ads"), payload);
      showToast("تم إطلاق الحملة الإعلانية في الموقع بنجاح!");
    }
    resetAdForm();
    await loadAds();
  } catch (err) {
    showToast("تعذر حفظ الإعلان: " + err.message, true);
  }
});

function resetAdForm() {
  document.getElementById("ad-form").reset();
  document.getElementById("ad-id").value = "";
  document.getElementById("ad-form-heading").textContent = "إضافة حملة إعلانية / رعاية جديدة";
  document.getElementById("cancel-ad-edit-btn").classList.add("hidden");
  showImagePreview("ad-preview-wrap", "ad-image-preview", "");
}

document.getElementById("cancel-ad-edit-btn").addEventListener("click", resetAdForm);

window.editAd = (id) => {
  const ad = allAds.find(a => a.id === id);
  if (!ad) return;
  document.getElementById("ad-id").value = ad.id;
  document.getElementById("ad-style").value = ad.adStyle || "banner";
  document.getElementById("ad-sponsor").value = ad.sponsorName || "";
  document.getElementById("ad-title").value = ad.title || "";
  document.getElementById("ad-target-url").value = ad.targetUrl || "";
  document.getElementById("ad-placement").value = ad.placement || "all";
  document.getElementById("ad-image-url").value = ad.imageUrl || "";
  showImagePreview("ad-preview-wrap", "ad-image-preview", ad.imageUrl || "");
  document.getElementById("ad-active").checked = ad.active !== false;

  document.getElementById("ad-form-heading").textContent = "تعديل الحملة الإعلانية";
  document.getElementById("cancel-ad-edit-btn").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.toggleAdStatus = async (id) => {
  const ad = allAds.find(a => a.id === id);
  if (!ad) return;
  const nextState = ad.active === false ? true : false;
  try {
    await updateDoc(doc(db, "ads", id), { active: nextState });
    showToast(nextState ? "تم تفعيل الإعلان" : "تم إيقاف الإعلان مؤقتاً");
    await loadAds();
  } catch (err) {
    showToast("خطأ: " + err.message, true);
  }
};

window.resetAdStats = async (id) => {
  if (!confirm("تصفير عدادات الظهور والنقرات لهذا الإعلان؟")) return;
  try {
    await updateDoc(doc(db, "ads", id), { views: 0, clicks: 0 });
    showToast("تم تصفير إحصائيات الإعلان");
    await loadAds();
  } catch (err) {
    showToast("خطأ: " + err.message, true);
  }
};

window.deleteAd = async (id) => {
  if (!confirm("تأكيد حذف الحملة الإعلانية نهائياً؟")) return;
  try {
    await deleteDoc(doc(db, "ads", id));
    showToast("تم حذف الإعلان");
    await loadAds();
  } catch (err) {
    showToast("خطأ في الحذف: " + err.message, true);
  }
};

// 10. هندسة الأقسام والقائمة الجانبية المرنة (مع زر إظهار/إخفاء بضغطة واحدة)
async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, "categories"));
    allCategories = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 99) - (b.order || 99));
    renderCategorySelects();
    renderCategoriesList();
    renderStaffCategoryPicker();
  } catch (err) {
    showToast("تنبيه في جلب الأقسام: " + err.message, true);
  }
}

function renderCategorySelects() {
  const select = document.getElementById("post-category");
  // للموظف غير السيادي: لا يظهر له في القائمة المنسدلة إلا الأقسام المسموحة له فقط
  const visibleCats = currentRole !== "super_admin"
    ? allCategories.filter(c => allowedCategories.includes(c.slug))
    : allCategories;

  if (visibleCats.length === 0 && currentRole !== "super_admin") {
    select.innerHTML = `<option value="">لم يتم تخصيص قسم لحسابك بعد</option>`;
    return;
  }

  select.innerHTML = `<option value="">اختر القسم...</option>` + visibleCats.map(c => (
    `<option value="${c.slug}">${c.name}</option>`
  )).join("");
}

document.getElementById("post-category").addEventListener("change", (e) => {
  populateSubcategories(e.target.value);
});

function populateSubcategories(catSlug, selectedSub = "") {
  const subSelect = document.getElementById("post-subcategory");
  const cat = allCategories.find(c => c.slug === catSlug);
  const subs = cat?.subcategories || [];
  subSelect.innerHTML = `<option value="">بدون قسم فرعي</option>` + subs.map(s => (
    `<option value="${s}" ${s === selectedSub ? "selected" : ""}>${s}</option>`
  )).join("");
}

function renderCategoriesList() {
  const container = document.getElementById("categories-list");
  if (!container) return;

  container.innerHTML = allCategories.map(c => {
    const isVisible = c.visible !== false;
    return `
      <div class="glass-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <div class="badges-row">
              <span class="status-badge ${isVisible ? "status-published" : "status-restricted"}">${isVisible ? "👁️ ظاهر في الموقع" : "🚫 مخفي حالياً"}</span>
              <span class="status-badge cat-badge">ترتيب: ${c.order || 1}</span>
            </div>
            <h4>${c.name} <small style="color:var(--text-muted)">(${c.nameEn || c.slug})</small></h4>
          </div>
        </div>
        <p class="status-hint" style="margin-top:8px;">المعرف: <code>${c.slug}</code> • الفروع: ${(c.subcategories || []).join(" ، ") || "لا يوجد"}</p>
        <div class="post-actions-bar" style="margin-top:12px;">
          <button class="action-chip ${isVisible ? "" : "chip-smart"}" onclick="window.toggleCategoryVisibility('${c.slug}')">
            <span class="material-symbols-rounded">${isVisible ? "visibility_off" : "visibility"}</span>
            <span>${isVisible ? "إخفاء القسم" : "إظهار القسم"}</span>
          </button>
          <button class="action-chip" onclick="window.editCategory('${c.slug}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          <button class="action-chip chip-danger" onclick="window.deleteCategory('${c.slug}')">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleCategoryVisibility = async (slug) => {
  const cat = allCategories.find(c => c.slug === slug);
  if (!cat) return;
  const nextVisible = cat.visible === false ? true : false;
  try {
    await updateDoc(doc(db, "categories", slug), { visible: nextVisible });
    showToast(nextVisible ? `تم إظهار قسم "${cat.name}" في الموقع العام` : `تم إخفاء قسم "${cat.name}" من الواجهة`);
    await loadCategories();
  } catch (err) {
    showToast("خطأ: " + err.message, true);
  }
};

window.editCategory = (slug) => {
  const cat = allCategories.find(c => c.slug === slug);
  if (!cat) return;
  document.getElementById("cat-name").value = cat.name || "";
  document.getElementById("cat-name-en").value = cat.nameEn || "";
  document.getElementById("cat-slug").value = cat.slug || "";
  document.getElementById("cat-icon").value = cat.icon || "newspaper";
  document.getElementById("cat-subs").value = (cat.subcategories || []).join(", ");
  document.getElementById("cat-order").value = cat.order || 1;
  document.getElementById("cat-visible").checked = cat.visible !== false;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.getElementById("category-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const slug = document.getElementById("cat-slug").value.trim().toLowerCase().replace(/\s+/g, "-");
    const subs = document.getElementById("cat-subs").value.split(",").map(s => s.trim()).filter(Boolean);

    await setDoc(doc(db, "categories", slug), {
      name: document.getElementById("cat-name").value.trim(),
      nameEn: document.getElementById("cat-name-en").value.trim(),
      slug: slug,
      icon: document.getElementById("cat-icon").value.trim() || "newspaper",
      subcategories: subs,
      order: parseInt(document.getElementById("cat-order").value || "1", 10),
      visible: document.getElementById("cat-visible").checked
    });
    document.getElementById("category-form").reset();
    showToast("تم حفظ القسم وتحديث القائمة الجانبية بنجاح");
    await loadCategories();
  } catch (err) {
    showToast("تعذر حفظ القسم: " + err.message, true);
  }
});

// توليد كافة الأقسام القياسية (بما فيها أقسام القائمة الجانبية المطلوبة)
document.getElementById("seed-categories-btn").addEventListener("click", async () => {
  try {
    const defaults = [
      { name: "محلية", nameEn: "Local News", slug: "local", icon: "location_on", order: 1, visible: true, subcategories: ["السياسة اليمنية", "شؤون المحافظات", "اقتصاد ومعيشة"] },
      { name: "دولية", nameEn: "International", slug: "world", icon: "public", order: 2, visible: true, subcategories: ["الشرق الأوسط", "السياسة الدولية", "تطورات إقليمية"] },
      { name: "تحقيقات وتقارير", nameEn: "Reports & Investigations", slug: "reports", icon: "policy", order: 3, visible: true, subcategories: ["ملفات خاصة", "تقارير معمقة", "كواليس السياسة"] },
      { name: "حوارات", nameEn: "Interviews", slug: "interviews", icon: "forum", order: 4, visible: true, subcategories: ["لقاءات خاصة", "ندوات سياسية"] },
      { name: "المقالات", nameEn: "Opinion Articles", slug: "articles", icon: "edit_note", order: 5, visible: true, subcategories: ["مقالات رأي", "قراءات استراتيجية"] },
      { name: "نافذة التقنية", nameEn: "Technology", slug: "tech", icon: "memory", order: 6, visible: true, subcategories: ["الذكاء الاصطناعي", "الهواتف والأنظمة", "الأمن السيبراني"] },
      { name: "الثقافة والفن", nameEn: "Culture & Art", slug: "culture", icon: "theater_comedy", order: 7, visible: true, subcategories: ["أدب وروايات", "فكر وتراث", "سينما وفنون"] },
      { name: "بودكاست", nameEn: "Podcast", slug: "podcast", icon: "podcasts", order: 8, visible: false, subcategories: ["بودكاست البوصلة", "حلقات صوتية"] },
      { name: "فيديو جرافيك", nameEn: "Video Graphics", slug: "infographic", icon: "monitoring", order: 9, visible: false, subcategories: ["إنفوجرافيك", "خرائط تفاعلية"] },
      { name: "الفيديو", nameEn: "Videos", slug: "video", icon: "smart_display", order: 10, visible: false, subcategories: ["تقارير مرئية", "وثائقيات قصيرة"] },
      { name: "الصور", nameEn: "Photo Gallery", slug: "photos", icon: "photo_library", order: 11, visible: false, subcategories: ["عدسة البوصلة", "حكاية صورة"] }
    ];
    for (const item of defaults) {
      await setDoc(doc(db, "categories", item.slug), item);
    }
    showToast("تم توليد كافة الأقسام القياسية! يمكنك إظهار أو إخفاء أي قسم بضغطة زر.");
    await loadCategories();
  } catch (err) {
    showToast("خطأ أثناء توليد الأقسام: " + err.message, true);
  }
});

window.deleteCategory = async (slug) => {
  if (!confirm("حذف هذا القسم نهائياً؟")) return;
  try {
    await deleteDoc(doc(db, "categories", slug));
    showToast("تم حذف القسم");
    await loadCategories();
  } catch (err) {
    showToast("خطأ في الحذف: " + err.message, true);
  }
};

// 11. إدارة فريق التحرير ومنتقي الأقسام الذكي بالبحث والنقر المباشر
const staffCatSearchInput = document.getElementById("staff-cat-search");
staffCatSearchInput.addEventListener("input", renderStaffCategoryPicker);

function renderStaffCategoryPicker() {
  const chipsContainer = document.getElementById("staff-cat-chips");
  const summaryContainer = document.getElementById("staff-selected-display");
  if (!chipsContainer || !summaryContainer) return;

  const q = (staffCatSearchInput.value || "").toLowerCase().trim();
  const filteredCats = allCategories.filter(c => {
    if (!q) return true;
    return (c.name || "").toLowerCase().includes(q) || (c.slug || "").toLowerCase().includes(q);
  });

  if (filteredCats.length === 0) {
    chipsContainer.innerHTML = `<span class="status-hint">لا توجد أقسام مطابقة للبحث...</span>`;
  } else {
    chipsContainer.innerHTML = filteredCats.map(c => {
      const isSelected = selectedStaffCategories.has(c.slug);
      return `
        <button type="button" class="cat-select-chip ${isSelected ? "selected" : ""}" onclick="window.toggleStaffCatChip('${c.slug}')">
          <span class="material-symbols-rounded" style="font-size:17px;">${isSelected ? "check_circle" : "add_circle"}</span>
          <span>${c.name}</span>
        </button>
      `;
    }).join("");
  }

  if (selectedStaffCategories.size === 0) {
    summaryContainer.innerHTML = `<span class="status-hint">لم يتم اختيار قسم بعد (اضغط على الأقسام أعلاه لتخصيصها للموظف)</span>`;
  } else {
    summaryContainer.innerHTML = Array.from(selectedStaffCategories).map(slug => {
      const catObj = allCategories.find(c => c.slug === slug);
      return `<span class="status-badge cat-badge">${catObj ? catObj.name : slug}</span>`;
    }).join("");
  }
}

window.toggleStaffCatChip = (slug) => {
  if (selectedStaffCategories.has(slug)) {
    selectedStaffCategories.delete(slug);
  } else {
    selectedStaffCategories.add(slug);
  }
  renderStaffCategoryPicker();
};

async function loadStaff() {
  try {
    const snap = await getDocs(collection(db, "staff"));
    allStaff = snap.docs.map(d => ({ email: d.id, ...d.data() }));
    const container = document.getElementById("staff-list");

    container.innerHTML = allStaff.map(m => {
      const catNames = (m.categories || []).map(slug => {
        const found = allCategories.find(c => c.slug === slug);
        return found ? found.name : slug;
      });

      return `
        <div class="glass-card">
          <h4>${m.name}</h4>
          <p class="status-hint">${m.email}</p>
          <div class="badges-row" style="margin-top:8px;">
            <span class="status-badge status-published">${m.role === "editor" ? "محرر معتمد" : "كاتب مسودات"}</span>
            <span class="status-badge cat-badge">الأقسام: ${catNames.length ? catNames.join(" ، ") : "غير محدد"}</span>
          </div>
          <div class="post-actions-bar" style="margin-top:12px;">
            <button class="action-chip" onclick="window.editStaffMember('${m.email}')">
              <span class="material-symbols-rounded">edit</span>
              <span>تعديل الأقسام</span>
            </button>
            <button class="action-chip chip-danger" onclick="window.removeStaff('${m.email}')">
              <span class="material-symbols-rounded">person_remove</span>
              <span>سحب الصلاحية</span>
            </button>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    showToast("تعذر جلب قائمة الفريق: " + err.message, true);
  }
}

window.editStaffMember = (email) => {
  const member = allStaff.find(m => m.email === email);
  if (!member) return;
  document.getElementById("staff-email").value = member.email;
  document.getElementById("staff-name").value = member.name || "";
  document.getElementById("staff-role").value = member.role || "editor";
  selectedStaffCategories = new Set(member.categories || []);
  renderStaffCategoryPicker();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

document.getElementById("staff-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("staff-email").value.trim().toLowerCase();

  if (SOVEREIGN_ADMINS.includes(email)) {
    showToast("هذا البريد مالك سيادي مطلق ولا يخضع لتقييد الأقسام!", true);
    return;
  }

  if (selectedStaffCategories.size === 0) {
    showToast("يرجى النقر على قسم واحد على الأقل لمنحه لهذا الموظف", true);
    return;
  }

  try {
    const catsArray = Array.from(selectedStaffCategories);
    await setDoc(doc(db, "staff", email), {
      name: document.getElementById("staff-name").value.trim(),
      role: document.getElementById("staff-role").value,
      categories: catsArray,
      active: true,
      updatedAt: serverTimestamp()
    });
    document.getElementById("staff-form").reset();
    selectedStaffCategories.clear();
    renderStaffCategoryPicker();
    showToast("تم اعتماد وحفظ صلاحيات الموظف وأقسامه بنجاح!");
    await loadStaff();
  } catch (err) {
    showToast("خطأ في حفظ الصلاحية: " + err.message, true);
  }
});

window.removeStaff = async (email) => {
  if (SOVEREIGN_ADMINS.includes(email.toLowerCase())) return;
  if (!confirm(`سحب الصلاحية نهائياً من ${email}؟`)) return;
  try {
    await deleteDoc(doc(db, "staff", email));
    showToast("تم سحب الصلاحية");
    await loadStaff();
  } catch (err) {
    showToast("خطأ: " + err.message, true);
  }
};

// 12. إدارة الهوية، اللغتين، الشعارات، وصفحات "من نحن" و"سياسة الخصوصية"
document.getElementById("upload-logo-btn").addEventListener("click", () => {
  document.getElementById("logo-file-picker").click();
});

document.getElementById("logo-file-picker").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("جاري رفع الشعار الجديد...");
  try {
    const url = await uploadToImgBB(file, 900);
    document.getElementById("set-logo-url").value = url;
    showToast("تم رفع الشعار! اضغط حفظ الإعدادات بالأسفل لاعتماده.");
  } catch (err) {
    showToast("فشل رفع الشعار: " + err.message, true);
  }
});

document.getElementById("upload-favicon-btn").addEventListener("click", () => {
  document.getElementById("favicon-file-picker").click();
});

document.getElementById("favicon-file-picker").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showToast("جاري رفع أيقونة البحث الجديدة...");
  try {
    const url = await uploadToImgBB(file, 256);
    document.getElementById("set-favicon-url").value = url;
    showToast("تم رفع الأيقونة! اضغط حفظ الإعدادات لاعتمادها.");
  } catch (err) {
    showToast("فشل رفع الأيقونة: " + err.message, true);
  }
});

// زر توليد نصوص "من نحن" و"سياسة الخصوصية" القياسية الجاهزة لقبول Google AdSense
document.getElementById("seed-legal-pages-btn").addEventListener("click", () => {
  const siteAr = document.getElementById("set-site-name").value.trim() || "بوصلة السياسة اليمنية";
  const netAr = document.getElementById("set-network-name").value.trim() || "شبكة البوصلة";
  const siteEn = document.getElementById("set-site-name-en").value.trim() || "Yemeni Politics Compass";

  document.getElementById("set-about-content").value = [
    `## من نحن — ${siteAr}`,
    `${siteAr} هي منصة إخبارية وتحليلية مستقلة تعمل ضمن "${netAr}"، تأسست لتقديم قراءة معمقة وموثوقة للأحداث السياسية، الاقتصادية، التقنية، والثقافية في اليمن والمنطقة والعالم.`,
    `## رؤيتنا ورسالتنا التحريرية`,
    `نؤمن في ${netAr} بأن الصحافة الرصينة هي بوصلة الوعي، ونلتزم بأعلى معايير الدقة المهنية، التحقق من المصادر، وفصل الخبر عن الرأي، مع توفير مساحة حرة للتحليلات الاستراتيجية والحوارات البناءة.`,
    `## فريق العمل`,
    `يدير المنصة نخبة من الصحفيين، المحررين، والكتاب المتخصصين في الشأن اليمني والدولي وصناعة المحتوى الرقمي الحديث.`
  ].join("\n\n");

  document.getElementById("set-about-content-en").value = [
    `## About ${siteEn}`,
    `${siteEn} is an independent news and analytical platform operating under Al-Bosla Media Network, dedicated to delivering in-depth coverage of Yemeni, regional, and international politics, technology, and culture.`,
    `## Editorial Mission`,
    `We adhere to strict journalistic integrity, fact-checking, and objective reporting to provide readers worldwide with reliable insights and strategic analysis.`
  ].join("\n\n");

  document.getElementById("set-privacy-content").value = [
    `## سياسة الخصوصية وحماية البيانات`,
    `تحترم منصة "${siteAr}" (${netAr}) خصوصية جميع زوارها وتلتزم بحماية بياناتهم وفق المعايير الدولية لخصوصية الاستخدام على شبكة الإنترنت.`,
    `## ملفات تعريف الارتباط (Cookies) وإعلانات Google AdSense`,
    `يستخدم موقعنا ملفات تعريف الارتباط لتحسين تجربة التصفح وحفظ تفضيلات القارئ (مثل الوضع الليلي واللغة). كما قد نستخدم خدمات إعلانية لطرف ثالث مثل (Google AdSense) والتي تستخدم ملفات تعريف الارتباط لعرض إعلانات ملائمة لاهتمامات الزائر.`,
    `## أمن المعلومات والروابط الخارجية`,
    `لا نقوم بجمع أي بيانات شخصية عن الزوار دون علمهم، وتخضع كافة البيانات التفاعلية لأعلى معايير التشفير والحماية.`
  ].join("\n\n");

  showToast("تم توليد صياغة احترافية لصفحتي من نحن وسياسة الخصوصية! يمكنك تعديلها وحفظ الإعدادات.");
});

async function loadGlobalSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) {
      const data = snap.data();
      globalSettings = {
        ...globalSettings,
        ...data,
        logoUrl: data.logoUrl || DEFAULT_LOGO,
        faviconUrl: data.faviconUrl || DEFAULT_FAVICON
      };
    }
    applySettingsToUI();
  } catch (err) {
    console.warn("Settings load warning:", err);
    applySettingsToUI();
  }
}

function applySettingsToUI() {
  const activeLogo = globalSettings.logoUrl || DEFAULT_LOGO;
  const activeFavicon = globalSettings.faviconUrl || DEFAULT_FAVICON;

  document.getElementById("header-logo-img").src = activeLogo;
  document.getElementById("login-logo-img").src = activeLogo;
  document.getElementById("admin-footer-logo").src = activeLogo;

  document.getElementById("dynamic-favicon").href = activeFavicon;
  document.getElementById("apple-favicon").href = activeFavicon;

  document.getElementById("header-network-name").textContent = globalSettings.siteName || "بوصلة السياسة اليمنية";
  document.getElementById("admin-footer-name").textContent = `غرفة العمليات المركزية — ${globalSettings.networkName || "شبكة البوصلة"}`;
  document.documentElement.style.setProperty("--accent", globalSettings.accentColor || "#3b82f6");

  document.getElementById("set-site-name").value = globalSettings.siteName || "";
  document.getElementById("set-site-name-en").value = globalSettings.siteNameEn || "Yemeni Politics Compass";
  document.getElementById("set-network-name").value = globalSettings.networkName || "";
  document.getElementById("set-network-name-en").value = globalSettings.networkNameEn || "Al-Bosla Network";
  document.getElementById("set-logo-url").value = activeLogo;
  document.getElementById("set-favicon-url").value = activeFavicon;
  document.getElementById("set-hide-text-logo").checked = globalSettings.hideTextLogo !== false;
  document.getElementById("set-site-desc").value = globalSettings.siteDesc || "";
  document.getElementById("set-public-url").value = globalSettings.publicUrl || "";
  document.getElementById("set-accent-color").value = globalSettings.accentColor || "#3b82f6";

  document.getElementById("set-show-about-menu").checked = globalSettings.showAboutMenu !== false;
  document.getElementById("set-about-content").value = globalSettings.aboutContent || "";
  document.getElementById("set-about-content-en").value = globalSettings.aboutContentEn || "";
  document.getElementById("set-privacy-content").value = globalSettings.privacyContent || "";
  document.getElementById("set-contact-email").value = globalSettings.contactEmail || "";
  document.getElementById("set-contact-phone").value = globalSettings.contactPhone || "";

  document.getElementById("set-ads-enabled").checked = !!globalSettings.adsEnabled;
  document.getElementById("set-adsense-id").value = globalSettings.adsenseId || "";
  document.getElementById("set-ad-slot").value = globalSettings.adSlot || "";
  document.getElementById("set-custom-ad-text").value = globalSettings.customAdText || "";
  document.getElementById("set-custom-ad-link").value = globalSettings.customAdLink || "";

  document.getElementById("set-social-whatsapp").value = globalSettings.socialWhatsapp || "";
  document.getElementById("set-social-facebook").value = globalSettings.socialFacebook || "";
  document.getElementById("set-social-x").value = globalSettings.socialX || "";
  document.getElementById("set-social-telegram").value = globalSettings.socialTelegram || "";

  document.getElementById("set-auto-tg-enabled").checked = !!globalSettings.autoTgEnabled;
  document.getElementById("set-tg-bot-token").value = globalSettings.tgBotToken || "";
  document.getElementById("set-tg-chat-id").value = globalSettings.tgChatId || "";

  document.getElementById("set-auto-fb-enabled").checked = !!globalSettings.autoFbEnabled;
  document.getElementById("set-fb-page-id").value = globalSettings.fbPageId || "";
  document.getElementById("set-fb-access-token").value = globalSettings.fbAccessToken || "";

  document.getElementById("set-auto-x-enabled").checked = !!globalSettings.autoXEnabled;
  document.getElementById("set-x-api-key").value = globalSettings.xApiKey || "";
  document.getElementById("set-x-webhook-url").value = globalSettings.xWebhookUrl || "";
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const updated = {
    siteName: document.getElementById("set-site-name").value.trim(),
    siteNameEn: document.getElementById("set-site-name-en").value.trim(),
    networkName: document.getElementById("set-network-name").value.trim(),
    networkNameEn: document.getElementById("set-network-name-en").value.trim(),
    logoUrl: document.getElementById("set-logo-url").value.trim() || DEFAULT_LOGO,
    faviconUrl: document.getElementById("set-favicon-url").value.trim() || DEFAULT_FAVICON,
    hideTextLogo: document.getElementById("set-hide-text-logo").checked,
    siteDesc: document.getElementById("set-site-desc").value.trim(),
    publicUrl: document.getElementById("set-public-url").value.trim(),
    accentColor: document.getElementById("set-accent-color").value,
    showAboutMenu: document.getElementById("set-show-about-menu").checked,
    aboutContent: document.getElementById("set-about-content").value.trim(),
    aboutContentEn: document.getElementById("set-about-content-en").value.trim(),
    privacyContent: document.getElementById("set-privacy-content").value.trim(),
    contactEmail: document.getElementById("set-contact-email").value.trim(),
    contactPhone: document.getElementById("set-contact-phone").value.trim(),
    adsEnabled: document.getElementById("set-ads-enabled").checked,
    adsenseId: document.getElementById("set-adsense-id").value.trim(),
    adSlot: document.getElementById("set-ad-slot").value.trim(),
    customAdText: document.getElementById("set-custom-ad-text").value.trim(),
    customAdLink: document.getElementById("set-custom-ad-link").value.trim(),
    socialWhatsapp: document.getElementById("set-social-whatsapp").value.trim(),
    socialFacebook: document.getElementById("set-social-facebook").value.trim(),
    socialX: document.getElementById("set-social-x").value.trim(),
    socialTelegram: document.getElementById("set-social-telegram").value.trim(),
    autoTgEnabled: document.getElementById("set-auto-tg-enabled").checked,
    tgBotToken: document.getElementById("set-tg-bot-token").value.trim(),
    tgChatId: document.getElementById("set-tg-chat-id").value.trim(),
    autoFbEnabled: document.getElementById("set-auto-fb-enabled").checked,
    fbPageId: document.getElementById("set-fb-page-id").value.trim(),
    fbAccessToken: document.getElementById("set-fb-access-token").value.trim(),
    autoXEnabled: document.getElementById("set-auto-x-enabled").checked,
    xApiKey: document.getElementById("set-x-api-key").value.trim(),
    xWebhookUrl: document.getElementById("set-x-webhook-url").value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "settings", "global"), updated);
    globalSettings = updated;
    applySettingsToUI();
    showToast("تم حفظ الهوية والصفحات القانونية والإعدادات وتعميمها بنجاح!");
  } catch (err) {
    showToast("خطأ في حفظ الإعدادات: " + err.message, true);
  }
});

// 13. محرك النشر التلقائي للمنصات
async function triggerAutoSocialPublish(post) {
  const articleUrl = `${(globalSettings.publicUrl || "").replace(/\/$/, "")}/?post=${post.id}`;
  const text = `🧭 ${globalSettings.siteName}\n📌 ${post.title}\n\n${post.summary}\n\n🔗 ${articleUrl}`;

  if (globalSettings.autoTgEnabled && globalSettings.tgBotToken && globalSettings.tgChatId) {
    try {
      await fetch(`https://api.telegram.org/bot${globalSettings.tgBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: globalSettings.tgChatId, text })
      });
    } catch (e) { console.warn("Telegram Auto-Publish Error:", e); }
  }

  if (globalSettings.autoFbEnabled && globalSettings.fbPageId && globalSettings.fbAccessToken) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/${globalSettings.fbPageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, link: articleUrl, access_token: globalSettings.fbAccessToken })
      });
    } catch (e) { console.warn("Facebook Auto-Publish Error:", e); }
  }

  if (globalSettings.autoXEnabled && globalSettings.xWebhookUrl) {
    try {
      await fetch(globalSettings.xWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: post.title, summary: post.summary, url: articleUrl })
      });
    } catch (e) { console.warn("X Auto-Publish Error:", e); }
  }
}
