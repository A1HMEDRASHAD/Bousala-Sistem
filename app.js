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

// 1. إعدادات Firebase الخاصة بك
const firebaseConfig = {
  apiKey: "AIzaSyAd4Df_Fpp2GlGkRPyvmKuFW68LbL_a4yU",
  authDomain: "rawi-01.firebaseapp.com",
  projectId: "rawi-01",
  storageBucket: "rawi-01.firebasestorage.app",
  messagingSenderId: "91203142966",
  appId: "1:91203142966:web:a44f7c06c98529a57a9f97",
  measurementId: "G-2VNWNSZLBJ"
};

// 2. الثوابت السيادية ومفتاح ImgBB والروابط الافتراضية للشعار والأيقونة
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

// متغيرات حالة النظام
let currentUser = null;
let currentRole = null; // 'super_admin' | 'editor' | 'writer'
let allowedCategories = [];
let allPosts = [];
let allCategories = [];
let allAds = [];

let globalSettings = {
  siteName: "بوصلة السياسة اليمنية",
  networkName: "شبكة البوصلة",
  siteDesc: "منصة إخبارية وتحليلية ترصد كواليس السياسة والتقنية والثقافة",
  publicUrl: "",
  logoUrl: DEFAULT_LOGO,
  faviconUrl: DEFAULT_FAVICON,
  hideTextLogo: true,
  accentColor: "#3b82f6",
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

// 3. تسجيل الدخول والتحقق من الهوية السيادية
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
    allowedCategories = [];
    initDashboard();
    return;
  }

  try {
    const staffSnap = await getDoc(doc(db, "staff", email));
    if (staffSnap.exists() && staffSnap.data().active !== false) {
      const data = staffSnap.data();
      currentUser = user;
      currentRole = data.role || "writer";
      allowedCategories = data.categories || [];
      initDashboard(data.name);
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

async function initDashboard(staffCustomName) {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");

  const badge = document.getElementById("user-role-badge");
  if (currentRole === "super_admin") {
    badge.textContent = "قيادة سيادية مطلقة";
    document.querySelectorAll(".super-only").forEach(el => el.classList.remove("hidden"));
  } else {
    badge.textContent = currentRole === "editor" ? "محرر معتمد" : "كاتب (مسودات)";
    document.querySelectorAll(".super-only").forEach(el => el.classList.add("hidden"));
  }

  document.getElementById("post-author").value = staffCustomName || currentUser.displayName || "هيئة التحرير";

  await loadGlobalSettings();
  await loadCategories();
  await loadPosts();
  if (currentRole === "super_admin") {
    await loadAds();
    await loadStaff();
  }
}

// التنقل بين التبويبات
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
  document.querySelector(`.nav-item[data-target="${tabId}"]`)?.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 4. محرك ضغط ورفع الصور إلى ImgBB (يخدم المقالات + الإعلانات + الشعار + الأيقونة)
function compressImageFile(file, maxWidth = 1200, quality = 0.84) {
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

// رفع صورة المقال
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
    showToast("تم رفع صورة المقال بنجاح");
  } catch (err) {
    statusText.textContent = "تعذر رفع الصورة";
    showToast("خطأ في رفع الصورة: " + err.message, true);
  }
});

document.getElementById("post-image-url").addEventListener("input", (e) => {
  showImagePreview("image-preview-wrap", "post-image-preview", e.target.value.trim());
});

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

// شريط تنسيق النص السريع
document.querySelectorAll(".tool-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const textarea = document.getElementById("post-content");
    const insertText = btn.dataset.insert.replace("\\n", "\n");
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end);
    textarea.focus();
  });
});

// 5. إدارة المنشورات والأخبار
async function loadPosts() {
  const listEl = document.getElementById("posts-list");
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    allPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    if (searchTerm && !(post.title || "").toLowerCase().includes(searchTerm) && !(post.author || "").toLowerCase().includes(searchTerm)) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد منشورات مطابقة حالياً</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(post => {
    const statusLabel = post.status === "published" ? "منشور" : post.status === "restricted" ? "مقيّد (مخفي)" : "مسودة";
    const statusClass = post.status === "published" ? "status-published" : post.status === "restricted" ? "status-restricted" : "status-draft";
    const thumb = post.imageUrl || globalSettings.logoUrl || DEFAULT_LOGO;

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="صورة" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${statusClass}">${statusLabel}</span>
              <span class="status-badge cat-badge">${post.categoryName || post.category || "عام"}</span>
              ${post.isBreaking ? `<span class="status-badge status-restricted">عاجل</span>` : ""}
              ${post.isFeatured ? `<span class="status-badge status-draft">صدارة Hero</span>` : ""}
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
          ${post.imageUrl ? `
          <a href="${post.imageUrl}" target="_blank" download class="action-chip" style="text-decoration:none;">
            <span class="material-symbols-rounded">download</span>
            <span>الصورة</span>
          </a>` : ""}
          <button class="action-chip" onclick="window.editPost('${post.id}')">
            <span class="material-symbols-rounded">edit</span>
            <span>تعديل</span>
          </button>
          ${currentRole !== "writer" ? `
          <button class="action-chip" onclick="window.toggleRestrictPost('${post.id}')">
            <span class="material-symbols-rounded">${post.status === "published" ? "visibility_off" : "publish"}</span>
            <span>${post.status === "published" ? "تقييد" : "نشر"}</span>
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
  const categoryName = catSelect.options[catSelect.selectedIndex]?.textContent || "";

  if (!categorySlug) {
    showToast("يرجى اختيار القسم الرئيسي أولاً", true);
    return;
  }

  const tagsRaw = document.getElementById("post-tags").value;
  const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

  const payload = {
    title: document.getElementById("post-title").value.trim(),
    summary: document.getElementById("post-summary").value.trim(),
    category: categorySlug,
    categoryName: categoryName,
    subcategory: document.getElementById("post-subcategory").value,
    author: document.getElementById("post-author").value.trim(),
    authorEmail: currentUser.email.toLowerCase(),
    sourceUrl: document.getElementById("post-source-url").value.trim(),
    imageUrl: document.getElementById("post-image-url").value.trim(),
    content: document.getElementById("post-content").value.trim(),
    tags: tags,
    isBreaking: document.getElementById("post-is-breaking").checked,
    isFeatured: document.getElementById("post-is-featured").checked,
    status: status,
    updatedAt: serverTimestamp()
  };

  try {
    if (postId) {
      await updateDoc(doc(db, "posts", postId), payload);
      showToast("تم تحديث المقال بنجاح");
    } else {
      payload.createdAt = serverTimestamp();
      payload.views = 0;
      const docRef = await addDoc(collection(db, "posts"), payload);
      if (status === "published") {
        await triggerAutoSocialPublish({ id: docRef.id, ...payload });
      }
      showToast(status === "published" ? "تم نشر المقال بنجاح!" : "تم حفظ المسودة بنجاح");
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
  document.getElementById("editor-heading").textContent = "نشر مادة صحفية";
  document.getElementById("cancel-edit-btn").classList.add("hidden");
  showImagePreview("image-preview-wrap", "post-image-preview", "");
  document.getElementById("post-author").value = currentUser?.displayName || "هيئة التحرير";
}

document.getElementById("cancel-edit-btn").addEventListener("click", () => {
  resetPostForm();
  switchTab("tab-posts");
});

window.editPost = (id) => {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;
  document.getElementById("post-id").value = post.id;
  document.getElementById("post-title").value = post.title || "";
  document.getElementById("post-summary").value = post.summary || "";
  document.getElementById("post-category").value = post.category || "";
  populateSubcategories(post.category, post.subcategory);
  document.getElementById("post-author").value = post.author || "";
  document.getElementById("post-source-url").value = post.sourceUrl || "";
  document.getElementById("post-image-url").value = post.imageUrl || "";
  showImagePreview("image-preview-wrap", "post-image-preview", post.imageUrl || "");
  document.getElementById("post-content").value = post.content || "";
  document.getElementById("post-tags").value = (post.tags || []).join(", ");
  document.getElementById("post-is-breaking").checked = !!post.isBreaking;
  document.getElementById("post-is-featured").checked = !!post.isFeatured;

  document.getElementById("editor-heading").textContent = "تعديل المادة الصحفية";
  document.getElementById("cancel-edit-btn").classList.remove("hidden");
  switchTab("tab-editor");
};

window.toggleRestrictPost = async (id) => {
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

// 6. نظام إدارة الرعايات والإعلانات الممولة (جديد)
document.getElementById("trigger-ad-upload-btn").addEventListener("click", () => {
  document.getElementById("ad-image-file").click();
});

document.getElementById("ad-image-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("ad-upload-status");
  statusEl.textContent = "جاري رفع صورة الإعلان...";
  try {
    const url = await uploadToImgBB(file, 900);
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
    listEl.innerHTML = `<div class="glass-card" style="text-align:center;color:var(--text-muted)">لا توجد حملات إعلانية مضافة حالياً. أضف أول إعلان من النموذج أعلاه.</div>`;
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

    return `
      <article class="glass-card post-item">
        <div class="post-top">
          <img src="${thumb}" alt="${ad.sponsorName}" class="post-thumb">
          <div class="post-meta-info">
            <div class="badges-row">
              <span class="status-badge ${isActive ? "status-published" : "status-restricted"}">${isActive ? "إعلان نشط" : "متوقف مؤقتاً"}</span>
              <span class="status-badge cat-badge">${placementNames[ad.placement] || "جميع المواضع"}</span>
            </div>
            <h3>${ad.title}</h3>
            <div class="post-submeta">الراعي: <strong>${ad.sponsorName}</strong> • الرابط: <a href="${ad.targetUrl}" target="_blank" style="color:var(--accent)">فتح الرابط</a></div>
            <div class="ad-metrics-bar">
              <span class="metric-pill views">👁️ الظهور: ${views}</span>
              <span class="metric-pill clicks">ads_click النقرات: ${clicks}</span>
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
  if (!confirm("هل تريد تصفير عدادات الظهور والنقرات لهذا الإعلان؟")) return;
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

// 7. إدارة الأقسام (مع نظام التقاط الأخطاء الصارم)
async function loadCategories() {
  try {
    const snap = await getDocs(collection(db, "categories"));
    allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategorySelects();
    renderCategoriesList();
  } catch (err) {
    showToast("تنبيه في جلب الأقسام: " + err.message, true);
  }
}

function renderCategorySelects() {
  const select = document.getElementById("post-category");
  const visibleCats = allowedCategories.length > 0 && currentRole !== "super_admin"
    ? allCategories.filter(c => allowedCategories.includes(c.slug))
    : allCategories;

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
  container.innerHTML = allCategories.map(c => `
    <div class="glass-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>${c.name} (${c.slug})</strong>
        <button class="action-chip chip-danger" onclick="window.deleteCategory('${c.slug}')">حذف</button>
      </div>
      <p class="status-hint" style="margin-top:8px;">الفروع: ${(c.subcategories || []).join(" ، ") || "لا يوجد"}</p>
    </div>
  `).join("");
}

document.getElementById("category-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const slug = document.getElementById("cat-slug").value.trim().toLowerCase().replace(/\s+/g, "-");
    const subs = document.getElementById("cat-subs").value.split(",").map(s => s.trim()).filter(Boolean);

    await setDoc(doc(db, "categories", slug), {
      name: document.getElementById("cat-name").value.trim(),
      slug: slug,
      icon: document.getElementById("cat-icon").value.trim() || "newspaper",
      subcategories: subs
    });
    document.getElementById("category-form").reset();
    showToast("تم حفظ القسم بنجاح");
    await loadCategories();
  } catch (err) {
    showToast("تعذر حفظ القسم: " + err.message, true);
  }
});

document.getElementById("seed-categories-btn").addEventListener("click", async () => {
  try {
    const defaults = [
      { name: "السياسة اليمنية", slug: "yemen-politics", icon: "balance", subcategories: ["شؤون الجنوب", "شؤون الشمال", "مفاوضات وتحالفات"] },
      { name: "كواليس وتحليلات", slug: "analysis", icon: "psychology", subcategories: ["قراءات استراتيجية", "دراسات وأبحاث", "مقالات رأي"] },
      { name: "نافذة التقنية", slug: "tech", icon: "memory", subcategories: ["الذكاء الاصطناعي", "الهواتف والأنظمة", "الأمن السيبراني"] },
      { name: "الثقافة والفن", slug: "culture", icon: "theater_comedy", subcategories: ["أدب وروايات", "فنون وسينما", "تراث وفكر"] },
      { name: "إقليمي ودولي", slug: "world", icon: "public", subcategories: ["الشرق الأوسط", "السياسة الدولية", "اقتصاد عالمي"] }
    ];
    for (const item of defaults) {
      await setDoc(doc(db, "categories", item.slug), item);
    }
    showToast("تم توليد الأقسام القياسية بنجاح!");
    await loadCategories();
  } catch (err) {
    showToast("خطأ أثناء توليد الأقسام: " + err.message, true);
  }
});

window.deleteCategory = async (slug) => {
  if (!confirm("حذف هذا القسم؟")) return;
  try {
    await deleteDoc(doc(db, "categories", slug));
    showToast("تم حذف القسم");
    await loadCategories();
  } catch (err) {
    showToast("خطأ في الحذف: " + err.message, true);
  }
};

// 8. إدارة فريق التحرير
async function loadStaff() {
  try {
    const snap = await getDocs(collection(db, "staff"));
    const staffMembers = snap.docs.map(d => ({ email: d.id, ...d.data() }));
    const container = document.getElementById("staff-list");

    container.innerHTML = staffMembers.map(m => `
      <div class="glass-card">
        <h4>${m.name}</h4>
        <p class="status-hint">${m.email}</p>
        <div class="badges-row" style="margin-top:8px;">
          <span class="status-badge status-published">${m.role === "editor" ? "محرر معتمد" : "كاتب مسودات"}</span>
          <span class="status-badge cat-badge">${(m.categories || []).length ? m.categories.join(", ") : "كل الأقسام"}</span>
        </div>
        <div style="margin-top:12px;">
          <button class="action-chip chip-danger" onclick="window.removeStaff('${m.email}')">سحب الصلاحية</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    showToast("تعذر جلب قائمة الفريق: " + err.message, true);
  }
}

document.getElementById("staff-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("staff-email").value.trim().toLowerCase();

  if (SOVEREIGN_ADMINS.includes(email)) {
    showToast("هذا البريد مالك سيادي مطلق!", true);
    return;
  }

  try {
    const cats = document.getElementById("staff-categories").value.split(",").map(c => c.trim()).filter(Boolean);
    await setDoc(doc(db, "staff", email), {
      name: document.getElementById("staff-name").value.trim(),
      role: document.getElementById("staff-role").value,
      categories: cats,
      active: true,
      updatedAt: serverTimestamp()
    });
    document.getElementById("staff-form").reset();
    showToast("تم حفظ صلاحيات العضو بنجاح");
    await loadStaff();
  } catch (err) {
    showToast("خطأ في حفظ الصلاحية: " + err.message, true);
  }
});

window.removeStaff = async (email) => {
  if (SOVEREIGN_ADMINS.includes(email.toLowerCase())) return;
  if (!confirm(`سحب الصلاحية من ${email}؟`)) return;
  try {
    await deleteDoc(doc(db, "staff", email));
    showToast("تم سحب الصلاحية");
    await loadStaff();
  } catch (err) {
    showToast("خطأ: " + err.message, true);
  }
};

// 9. إدارة الهوية البصرية والشعار الأفقي وأيقونة محركات البحث (Favicon)
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

  // تحديث الشعار في الترويسة، شاشة الدخول، والتذييل
  document.getElementById("header-logo-img").src = activeLogo;
  document.getElementById("login-logo-img").src = activeLogo;
  document.getElementById("admin-footer-logo").src = activeLogo;

  // تحديث أيقونة المتصفح ومحركات البحث
  document.getElementById("dynamic-favicon").href = activeFavicon;
  document.getElementById("apple-favicon").href = activeFavicon;

  document.getElementById("header-network-name").textContent = globalSettings.siteName || "بوصلة السياسة اليمنية";
  document.getElementById("admin-footer-name").textContent = `غرفة العمليات المركزية — ${globalSettings.networkName || "شبكة البوصلة"}`;
  document.documentElement.style.setProperty("--accent", globalSettings.accentColor || "#3b82f6");

  // تعبئة حقول الإعدادات
  document.getElementById("set-site-name").value = globalSettings.siteName || "";
  document.getElementById("set-network-name").value = globalSettings.networkName || "";
  document.getElementById("set-logo-url").value = activeLogo;
  document.getElementById("set-favicon-url").value = activeFavicon;
  document.getElementById("set-hide-text-logo").checked = globalSettings.hideTextLogo !== false;
  document.getElementById("set-site-desc").value = globalSettings.siteDesc || "";
  document.getElementById("set-public-url").value = globalSettings.publicUrl || "";
  document.getElementById("set-accent-color").value = globalSettings.accentColor || "#3b82f6";

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
    networkName: document.getElementById("set-network-name").value.trim(),
    logoUrl: document.getElementById("set-logo-url").value.trim() || DEFAULT_LOGO,
    faviconUrl: document.getElementById("set-favicon-url").value.trim() || DEFAULT_FAVICON,
    hideTextLogo: document.getElementById("set-hide-text-logo").checked,
    siteDesc: document.getElementById("set-site-desc").value.trim(),
    publicUrl: document.getElementById("set-public-url").value.trim(),
    accentColor: document.getElementById("set-accent-color").value,
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
    showToast("تم حفظ الهوية والشعار والإعدادات وتعميمها بنجاح!");
  } catch (err) {
    showToast("خطأ في حفظ الإعدادات: " + err.message, true);
  }
});

// 10. محرك النشر التلقائي للمنصات
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
