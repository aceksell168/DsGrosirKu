/* =========================================================
   GrosirKu — Dashboard Manajemen Toko Grosir
   Application logic
   PERINGATAN: Aplikasi ini 100% berjalan di browser (client-side).
   Login & whitelist IP di sini adalah fitur TAMPILAN/DEMO, bukan
   keamanan sungguhan — siapapun bisa membaca source code ini di
   GitHub. Jangan gunakan untuk data sensitif produksi tanpa backend.
   ========================================================= */
(() => {
  "use strict";

  /* ---------------------------------------------------------
     Constants & state
  --------------------------------------------------------- */
  const STORAGE_KEYS = ["products", "sales", "priceHistory", "supplierHistory", "whitelistIPs"];
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  const USERS = [
    { username: "admin", password: "admin123", role: "admin", name: "Administrator" },
    { username: "manager", password: "manager123", role: "manager", name: "Manager" },
    { username: "kasir1", password: "kasir123", role: "kasir", name: "Kasir 1" },
    { username: "kasir2", password: "kasir123", role: "kasir", name: "Kasir 2" },
  ];

  let currentUser = null;
  let currentIP = null;
  let chartInstance = null;
  let uidCounter = 1;

  const uid = () => Date.now().toString(36) + (uidCounter++).toString(36);

  const defaultData = () => ({
    products: [
      { id: uid(), name: "Beras Premium 5kg", modalPrice: 55000, price: 65000, stock: 120, supplier: "Supplier A" },
      { id: uid(), name: "Minyak Goreng 2L", modalPrice: 28000, price: 32000, stock: 85, supplier: "Supplier B" },
      { id: uid(), name: "Gula Pasir 1kg", modalPrice: 12000, price: 14000, stock: 200, supplier: "Supplier C" },
      { id: uid(), name: "Tepung Terigu 1kg", modalPrice: 10000, price: 12000, stock: 150, supplier: "Supplier A" },
      { id: uid(), name: "Mie Instan 1 Dus", modalPrice: 75000, price: 85000, stock: 45, supplier: "Supplier D" },
    ],
    sales: [],
    priceHistory: [],
    supplierHistory: [],
    whitelistIPs: [],
  });

  function loadData() {
    const out = {};
    let seed = null;
    STORAGE_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { out[key] = JSON.parse(raw); } catch { out[key] = null; }
      }
    });
    if (!out.products) {
      seed = seed || defaultData();
      STORAGE_KEYS.forEach((k) => { if (!out[k]) out[k] = seed[k]; });
    }
    STORAGE_KEYS.forEach((k) => { if (!out[k]) out[k] = []; });
    return out;
  }

  let data = loadData();

  function persist(key) {
    localStorage.setItem(key, JSON.stringify(data[key]));
  }

  /* ---------------------------------------------------------
     Utilities
  --------------------------------------------------------- */
  const $ = (id) => document.getElementById(id);
  const fmtRupiah = (n) => "Rp " + Math.round(n || 0).toLocaleString("id-ID");
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID") + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };
  const escapeHtml = (str) => String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function findProduct(id) { return data.products.find((p) => p.id === id); }
  function productIndex(id) { return data.products.findIndex((p) => p.id === id); }

  /* ---------------------------------------------------------
     Toasts (replaces alert())
  --------------------------------------------------------- */
  const ICONS = { success: "fa-circle-check", error: "fa-circle-exclamation", warning: "fa-triangle-exclamation", info: "fa-circle-info" };
  function toast(message, type = "info", timeout = 3600) {
    const stack = $("toastStack");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.info}"></i><span>${escapeHtml(message)}</span>`;
    stack.appendChild(el);
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 220);
    }, timeout);
  }

  /* ---------------------------------------------------------
     Confirm dialog (replaces confirm())
  --------------------------------------------------------- */
  function confirmDialog({ title, message, confirmText = "Konfirmasi", tone = "danger" }) {
    return new Promise((resolve) => {
      const overlay = $("confirmModal");
      $("confirmIcon").className = `confirm-icon ${tone === "danger" ? "danger" : "warn"}`;
      $("confirmIcon").innerHTML = `<i class="fa-solid ${tone === "danger" ? "fa-trash" : "fa-triangle-exclamation"}"></i>`;
      $("confirmTitle").textContent = title;
      $("confirmMessage").textContent = message;
      const btnOk = $("confirmOkBtn");
      const btnCancel = $("confirmCancelBtn");
      btnOk.textContent = confirmText;
      btnOk.className = `btn ${tone === "danger" ? "btn-danger" : "btn-accent"}`;

      const cleanup = (result) => {
        overlay.classList.remove("is-visible");
        btnOk.removeEventListener("click", onOk);
        btnCancel.removeEventListener("click", onCancel);
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      btnOk.addEventListener("click", onOk);
      btnCancel.addEventListener("click", onCancel);
      overlay.classList.add("is-visible");
    });
  }

  /* ---------------------------------------------------------
     Modal helpers
  --------------------------------------------------------- */
  function openModal(id) { $(id).classList.add("is-visible"); }
  function closeModal(id) { $(id).classList.remove("is-visible"); }
  window.closeModal = closeModal;

  /* ---------------------------------------------------------
     Theme
  --------------------------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    document.querySelectorAll(".theme-option").forEach((el) => el.classList.toggle("active", el.dataset.theme === theme));
    const icon = $("themeToggleIcon");
    if (icon) icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
  function initTheme() {
    const saved = localStorage.getItem("theme") ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(saved);
  }
  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }

  /* ---------------------------------------------------------
     Auth
  --------------------------------------------------------- */
  async function getCurrentIP() {
    $("currentIPDisplay").textContent = "Mendeteksi...";
    try {
      const res = await fetch("https://api.ipify.org?format=json");
      const json = await res.json();
      currentIP = json.ip;
    } catch {
      currentIP = null;
    }
    $("currentIPDisplay").textContent = currentIP || "Tidak dapat mendeteksi IP";
    return currentIP;
  }

  function activeWhitelist() { return data.whitelistIPs.filter((ip) => ip.status === "active"); }

  function checkIPAccess() {
    // If the whitelist is empty, access is allowed for everyone (feature is opt-in).
    if (data.whitelistIPs.length === 0) return true;
    return activeWhitelist().some((ip) => ip.ip === currentIP);
  }

  function showLoginError(message) {
    const el = $("loginError");
    el.textContent = message;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 4000);
  }

  async function login(e) {
    e.preventDefault();
    const username = $("loginUsername").value.trim();
    const password = $("loginPassword").value;
    if (!username || !password) return showLoginError("Username dan password harus diisi.");

    const found = USERS.find((u) => u.username === username && u.password === password);
    if (!found) return showLoginError("Username atau password salah.");

    const btn = $("loginSubmitBtn");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memeriksa akses...';
    await getCurrentIP();
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Masuk';

    if (!checkIPAccess()) {
      $("ipWarning").classList.remove("hidden");
      showLoginError("Akses ditolak: IP Anda tidak ada dalam whitelist.");
      return;
    }
    currentUser = found;
    sessionStorage.setItem("loginUser", JSON.stringify(found));
    enterApp();
  }

  async function checkAuth() {
    const saved = sessionStorage.getItem("loginUser");
    if (!saved) return;
    currentUser = JSON.parse(saved);
    await getCurrentIP();
    if (checkIPAccess()) {
      enterApp();
    } else {
      $("ipWarning").classList.remove("hidden");
      showLoginError("Akses ditolak dari IP ini. Silakan login ulang.");
      sessionStorage.removeItem("loginUser");
      currentUser = null;
    }
  }

  async function logout() {
    const ok = await confirmDialog({ title: "Keluar dari akun?", message: "Anda perlu login kembali untuk mengakses dashboard.", confirmText: "Ya, Logout", tone: "warn" });
    if (!ok) return;
    sessionStorage.removeItem("loginUser");
    location.reload();
  }

  function isManagerOrAdmin() { return currentUser && (currentUser.role === "manager" || currentUser.role === "admin"); }

  function guard(action) {
    if (!isManagerOrAdmin()) {
      toast("Hanya Manager atau Admin yang dapat melakukan aksi ini.", "warning");
      return false;
    }
    return true;
  }

  /* ---------------------------------------------------------
     App entry / navigation
  --------------------------------------------------------- */
  function enterApp() {
    $("loginScreen").classList.add("hidden");
    $("appShell").classList.add("is-visible");

    $("userNameDisplay").textContent = currentUser.name;
    const roleLabels = { admin: "Administrator", manager: "Manager", kasir: "Kasir" };
    $("userRoleDisplay").textContent = roleLabels[currentUser.role] || currentUser.role;
    $("userAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
    document.querySelectorAll(".requires-edit-access").forEach((el) => el.classList.toggle("hidden", !isManagerOrAdmin()));

    renderAll();
    checkExpiredBadge();
  }

  function renderAll() {
    renderDashboard();
    renderProducts();
    renderProfitAnalysis();
    renderSupplierHistory();
    renderSalesHistory();
    renderWhitelist();
  }

  function showSection(section) {
    document.querySelectorAll(".side-nav li").forEach((li) => li.classList.toggle("active", li.dataset.section === section));
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    const view = $(section + "View");
    if (view) view.classList.add("is-active");

    $("sidebarProductPanel").classList.toggle("is-active", section === "products");

    const titles = {
      dashboard: "Dashboard Penjualan", products: "Manajemen Produk", profit: "Analisis Keuntungan",
      supplier: "Restock Supplier", salesHistory: "History Penjualan", whitelist: "Keamanan & Whitelist IP",
      settings: "Pengaturan",
    };
    $("pageTitle").textContent = titles[section] || "Dashboard";

    if (window.innerWidth <= 1024) closeSidebar();

    const renderers = {
      dashboard: renderDashboard, products: renderProducts, profit: renderProfitAnalysis,
      supplier: renderSupplierHistory, salesHistory: renderSalesHistory, whitelist: renderWhitelist,
    };
    if (renderers[section]) renderers[section]();
  }
  window.showSection = showSection;

  function openSidebar() { $("sidebar").classList.add("is-open"); $("sidebarOverlay").classList.add("is-visible"); }
  function closeSidebar() { $("sidebar").classList.remove("is-open"); $("sidebarOverlay").classList.remove("is-visible"); }
  function toggleSidebar() { $("sidebar").classList.contains("is-open") ? closeSidebar() : openSidebar(); }

  /* ---------------------------------------------------------
     Dashboard
  --------------------------------------------------------- */
  function renderDashboard() {
    const select = $("saleProductSelect");
    select.innerHTML = '<option value="">Pilih produk...</option>';
    let totalStock = 0, totalValue = 0;

    data.products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.name} (Stok: ${p.stock}) — ${fmtRupiah(p.price)}`;
      select.appendChild(opt);
      totalStock += p.stock;
      totalValue += p.stock * p.modalPrice;
    });

    let totalProfit = 0;
    data.sales.forEach((s) => {
      const p = findProduct(s.productId);
      const modal = p ? p.modalPrice : s.modalPriceAtSale || 0;
      totalProfit += (s.price - modal) * s.qty;
    });

    $("statTotalProducts").textContent = data.products.length;
    $("statTotalStock").textContent = totalStock.toLocaleString("id-ID");
    $("statStockValue").textContent = fmtRupiah(totalValue);
    $("statTotalProfit").textContent = fmtRupiah(totalProfit);

    drawChart();
  }

  function drawChart() {
    const ctx = $("salesChart").getContext("2d");
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const recent = data.sales.filter((s) => new Date(s.date).getTime() >= cutoff);
    const totals = {};
    recent.forEach((s) => { totals[s.name] = (totals[s.name] || 0) + s.qty; });

    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const styles = getComputedStyle(document.documentElement);
    const primary = styles.getPropertyValue("--primary-500").trim();
    const border = styles.getPropertyValue("--border").trim();
    const ink = styles.getPropertyValue("--ink-soft").trim();

    if (chartInstance) chartInstance.destroy();

    if (entries.length === 0) {
      $("chartEmptyState").classList.remove("hidden");
      $("salesChart").classList.add("hidden");
      return;
    }
    $("chartEmptyState").classList.add("hidden");
    $("salesChart").classList.remove("hidden");

    chartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: entries.map((e) => e[0]),
        datasets: [{
          label: "Unit terjual (30 hari terakhir)",
          data: entries.map((e) => e[1]),
          backgroundColor: primary,
          borderRadius: 6,
          maxBarThickness: 46,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.raw.toLocaleString("id-ID")} unit` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: ink } },
          y: { beginAtZero: true, grid: { color: border }, ticks: { color: ink } },
        },
      },
    });
  }

  function sellProduct(e) {
    e.preventDefault();
    const productId = $("saleProductSelect").value;
    const qty = parseInt($("saleQtyInput").value, 10);

    if (!productId) return toast("Pilih produk terlebih dahulu.", "warning");
    if (!qty || qty <= 0) return toast("Masukkan jumlah yang valid.", "warning");

    const product = findProduct(productId);
    if (!product) return toast("Produk tidak ditemukan.", "error");
    if (product.stock < qty) return toast(`Stok tidak mencukupi. Tersedia: ${product.stock}`, "error");

    product.stock -= qty;
    const sale = {
      id: uid(), productId: product.id, name: product.name, qty,
      price: product.price, modalPriceAtSale: product.modalPrice,
      total: qty * product.price, date: new Date().toISOString(), seller: currentUser.name,
    };
    data.sales.push(sale);
    persist("sales"); persist("products");

    $("saleQtyInput").value = "";
    toast(`Penjualan berhasil: ${product.name} x${qty}`, "success");
    showReceipt(sale);
    renderDashboard(); renderProducts(); renderSalesHistory(); checkExpiredBadge();
  }

  function showReceipt(sale) {
    const profit = (sale.price - sale.modalPriceAtSale) * sale.qty;
    $("receiptBody").innerHTML = `
      <h4>GrosirKu</h4>
      <p class="r-sub">Struk Penjualan</p>
      <hr>
      <div class="r-row"><span>Tanggal</span><span>${fmtDate(sale.date)}</span></div>
      <div class="r-row"><span>Kasir</span><span>${escapeHtml(sale.seller)}</span></div>
      <hr>
      <div class="r-row"><span>${escapeHtml(sale.name)} × ${sale.qty}</span><span>${fmtRupiah(sale.price)}</span></div>
      <hr>
      <div class="r-row r-total"><span>Total</span><span>${fmtRupiah(sale.total)}</span></div>
      <div class="r-row" style="color:var(--success); font-size:12px;"><span>Estimasi keuntungan</span><span>${fmtRupiah(profit)}</span></div>
    `;
    openModal("receiptModal");
  }

  function printReceipt() { window.print(); }

  /* ---------------------------------------------------------
     Products
  --------------------------------------------------------- */
  function recentPriceChangeFor(productId) {
    for (let i = data.priceHistory.length - 1; i >= 0; i--) {
      const h = data.priceHistory[i];
      if (h.productId === productId && h.type !== "modal" && h.type !== "new") return h;
    }
    return null;
  }

  function renderProducts(filter = "") {
    const q = filter.trim().toLowerCase();
    const filtered = q ? data.products.filter((p) => p.name.toLowerCase().includes(q)) : data.products;

    // Sidebar mini list
    const miniList = $("miniProductList");
    miniList.innerHTML = "";
    if (filtered.length === 0) {
      miniList.innerHTML = '<li class="empty-note">Tidak ada produk cocok.</li>';
    } else {
      filtered.forEach((p) => {
        const li = document.createElement("li");
        li.innerHTML = `<div class="p-name">${escapeHtml(p.name)}</div><div class="p-meta">Stok ${p.stock} · ${fmtRupiah(p.price)}</div>`;
        li.addEventListener("click", () => {
          showSection("dashboard");
          $("saleProductSelect").value = p.id;
          $("saleQtyInput").focus();
        });
        miniList.appendChild(li);
      });
    }

    // Table
    const tbody = $("productsTableBody");
    tbody.innerHTML = "";
    const canEdit = isManagerOrAdmin();
    $("productsActionsHeader").style.display = canEdit ? "" : "none";

    if (filtered.length === 0) {
      $("productsEmptyState").classList.remove("hidden");
      $("productsTableWrap").classList.add("hidden");
    } else {
      $("productsEmptyState").classList.add("hidden");
      $("productsTableWrap").classList.remove("hidden");
    }

    filtered.forEach((p) => {
      const profit = p.price - p.modalPrice;
      const profitClass = profit > 10000 ? "ok" : profit < 3000 ? "bad" : "warn";
      const stockClass = p.stock < 10 ? "bad" : "ok";
      const recentChange = recentPriceChangeFor(p.id);
      let changeTag = "";
      if (recentChange && Date.now() - new Date(recentChange.changedAt).getTime() < 7 * 24 * 60 * 60 * 1000) {
        const up = recentChange.change > 0;
        changeTag = `<span class="price-tag-change ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(recentChange.percentChange)}%</span>`;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}<div style="font-size:11.5px;color:var(--ink-faint);">Supplier: ${escapeHtml(p.supplier || "-")}</div></td>
        <td class="num">${fmtRupiah(p.modalPrice)}</td>
        <td class="num">${fmtRupiah(p.price)} ${changeTag}</td>
        <td class="num"><span class="pill ${stockClass}">${p.stock}</span></td>
        <td class="num"><span class="pill ${profitClass}">${fmtRupiah(profit)}</span></td>
        <td class="requires-edit-access ${canEdit ? "" : "hidden"}">
          <div class="table-actions-cell">
            <button class="btn btn-sm btn-ghost" data-action="edit-price" data-id="${p.id}" title="Ubah harga jual"><i class="fa-solid fa-tag"></i></button>
            <button class="btn btn-sm btn-ghost" data-action="edit-modal" data-id="${p.id}" title="Ubah harga modal"><i class="fa-solid fa-coins"></i></button>
            <button class="btn btn-sm btn-ghost" data-action="restock" data-id="${p.id}" title="Restock"><i class="fa-solid fa-truck-ramp-box"></i></button>
            <button class="btn btn-sm btn-danger" data-action="delete-product" data-id="${p.id}" title="Hapus produk"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openAddProductModal() {
    if (!guard()) return;
    $("newProductForm").reset();
    openModal("addProductModal");
  }

  function saveNewProduct(e) {
    e.preventDefault();
    if (!guard()) return;
    const name = $("newProductName").value.trim();
    const modalPrice = parseInt($("newProductModalPrice").value, 10);
    const price = parseInt($("newProductSellPrice").value, 10);
    const stock = parseInt($("newProductStock").value, 10) || 0;
    const supplier = $("newProductSupplier").value.trim();

    if (!name) return toast("Nama produk harus diisi.", "warning");
    if (!modalPrice || modalPrice < 100) return toast("Harga modal minimal Rp 100.", "warning");
    if (!price || price < 100) return toast("Harga jual minimal Rp 100.", "warning");
    if (price <= modalPrice) return toast("Harga jual harus lebih tinggi dari harga modal.", "warning");
    if (stock < 0) return toast("Stok tidak boleh negatif.", "warning");

    const product = { id: uid(), name, modalPrice, price, stock, supplier: supplier || "-" };
    data.products.push(product);
    persist("products");

    if (stock > 0) {
      data.supplierHistory.push({ id: uid(), productId: product.id, productName: name, supplier: supplier || "-", quantity: stock, modalPrice, totalCost: stock * modalPrice, date: new Date().toISOString(), addedBy: currentUser.name });
      persist("supplierHistory");
    }
    data.priceHistory.push({ id: uid(), productId: product.id, productName: name, type: "new", oldPrice: 0, newPrice: price, change: price, percentChange: 100, reason: "Produk baru", changedBy: currentUser.name, changedAt: new Date().toISOString() });
    persist("priceHistory");

    closeModal("addProductModal");
    toast(`Produk "${name}" berhasil ditambahkan.`, "success");
    renderProducts(); renderSupplierHistory(); renderDashboard();
  }

  async function deleteProduct(id) {
    if (!guard()) return;
    const p = findProduct(id);
    if (!p) return;
    const ok = await confirmDialog({
      title: "Hapus produk ini?",
      message: `"${p.name}" akan dihapus dari daftar produk. Riwayat penjualan & harga sebelumnya tetap tersimpan.`,
      confirmText: "Hapus Produk", tone: "danger",
    });
    if (!ok) return;
    data.products.splice(productIndex(id), 1);
    persist("products");
    toast(`Produk "${p.name}" dihapus.`, "success");
    renderProducts(); renderDashboard();
  }

  function openEditPriceModal(id) {
    if (!guard()) return;
    const p = findProduct(id);
    $("editPriceProductId").value = id;
    $("editPriceProductName").textContent = p.name;
    $("editPriceModalCost").textContent = fmtRupiah(p.modalPrice);
    $("editPriceOldValue").textContent = fmtRupiah(p.price);
    $("editPriceNewInput").value = p.price;
    $("editPriceReason").value = "";
    renderDiff(p.price, p.price, "editPriceDiffPreview");
    openModal("editPriceModal");
  }

  function wirePriceDiffLive(inputId, oldGetter, previewId) {
    $(inputId).addEventListener("input", () => {
      const oldPrice = oldGetter();
      const newPrice = parseInt($(inputId).value, 10) || oldPrice;
      renderDiff(oldPrice, newPrice, previewId);
    });
  }

  function renderDiff(oldPrice, newPrice, previewId) {
    const diff = newPrice - oldPrice;
    const pct = oldPrice > 0 ? ((diff / oldPrice) * 100).toFixed(1) : "0.0";
    const el = $(previewId);
    if (diff === 0) { el.textContent = "Tidak ada perubahan"; el.style.color = "var(--ink-soft)"; }
    else if (diff > 0) { el.textContent = `▲ Naik ${pct}% (+${fmtRupiah(diff)})`; el.style.color = "var(--danger)"; }
    else { el.textContent = `▼ Turun ${Math.abs(pct)}% (${fmtRupiah(diff)})`; el.style.color = "var(--success)"; }
  }

  function savePriceChange(e) {
    e.preventDefault();
    if (!guard()) return;
    const id = $("editPriceProductId").value;
    const newPrice = parseInt($("editPriceNewInput").value, 10);
    const reason = $("editPriceReason").value.trim();
    if (!newPrice || newPrice < 100) return toast("Harga minimal Rp 100.", "warning");

    const p = findProduct(id);
    const oldPrice = p.price;
    if (newPrice === oldPrice) { closeModal("editPriceModal"); return toast("Tidak ada perubahan harga.", "info"); }

    data.priceHistory.push({ id: uid(), productId: p.id, productName: p.name, type: "jual", oldPrice, newPrice, change: newPrice - oldPrice, percentChange: (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1), reason: reason || "Tidak ada alasan", changedBy: currentUser.name, changedAt: new Date().toISOString() });
    persist("priceHistory");

    p.price = newPrice;
    persist("products");
    closeModal("editPriceModal");
    toast(`Harga jual "${p.name}" diperbarui menjadi ${fmtRupiah(newPrice)}.`, "success");
    renderProducts(); renderDashboard();
  }

  function openEditModalPriceModal(id) {
    if (!guard()) return;
    const p = findProduct(id);
    $("editModalCostProductId").value = id;
    $("editModalCostProductName").textContent = p.name;
    $("editModalCostOldValue").textContent = fmtRupiah(p.modalPrice);
    $("editModalCostNewInput").value = p.modalPrice;
    $("editModalCostReason").value = "";
    renderDiff(p.modalPrice, p.modalPrice, "editModalCostDiffPreview");
    openModal("editModalCostModal");
  }

  function saveModalPriceChange(e) {
    e.preventDefault();
    if (!guard()) return;
    const id = $("editModalCostProductId").value;
    const newPrice = parseInt($("editModalCostNewInput").value, 10);
    const reason = $("editModalCostReason").value.trim();
    if (!newPrice || newPrice < 100) return toast("Harga modal minimal Rp 100.", "warning");

    const p = findProduct(id);
    const oldPrice = p.modalPrice;
    if (newPrice === oldPrice) { closeModal("editModalCostModal"); return toast("Tidak ada perubahan.", "info"); }

    data.priceHistory.push({ id: uid(), productId: p.id, productName: p.name, type: "modal", oldPrice, newPrice, change: newPrice - oldPrice, percentChange: (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1), reason: reason || "Tidak ada alasan", changedBy: currentUser.name, changedAt: new Date().toISOString() });
    persist("priceHistory");

    p.modalPrice = newPrice;
    persist("products");
    closeModal("editModalCostModal");
    toast(`Harga modal "${p.name}" diperbarui.`, "success");
    renderProducts(); renderDashboard();
  }

  function openAddStockModal(id) {
    if (!guard()) return;
    const p = findProduct(id);
    $("restockProductId").value = id;
    $("restockProductName").value = p.name;
    $("restockCurrentStock").value = p.stock;
    $("restockCurrentModal").value = fmtRupiah(p.modalPrice);
    $("restockQty").value = 10;
    $("restockNewModalPrice").value = p.modalPrice;
    $("restockSupplier").value = p.supplier || "";
    openModal("restockModal");
  }

  function addStock(e) {
    e.preventDefault();
    if (!guard()) return;
    const id = $("restockProductId").value;
    const qty = parseInt($("restockQty").value, 10);
    const newModalPrice = parseInt($("restockNewModalPrice").value, 10);
    const supplier = $("restockSupplier").value.trim();

    if (!qty || qty <= 0) return toast("Jumlah restock tidak valid.", "warning");
    if (!newModalPrice || newModalPrice < 100) return toast("Harga modal minimal Rp 100.", "warning");
    if (!supplier) return toast("Nama supplier harus diisi.", "warning");

    const p = findProduct(id);
    const oldStock = p.stock, oldModal = p.modalPrice;
    if (newModalPrice !== oldModal) {
      p.modalPrice = Math.round(((oldStock * oldModal) + (qty * newModalPrice)) / (oldStock + qty));
    }
    p.stock += qty;
    p.supplier = supplier;
    persist("products");

    data.supplierHistory.push({ id: uid(), productId: p.id, productName: p.name, supplier, quantity: qty, modalPrice: newModalPrice, totalCost: qty * newModalPrice, date: new Date().toISOString(), addedBy: currentUser.name });
    persist("supplierHistory");

    closeModal("restockModal");
    toast(`Restock "${p.name}" berhasil: +${qty} unit.`, "success");
    renderProducts(); renderSupplierHistory(); renderDashboard();
  }

  /* ---------------------------------------------------------
     Price history viewer
  --------------------------------------------------------- */
  function openPriceHistoryModal() {
    const body = $("priceHistoryBody");
    if (data.priceHistory.length === 0) {
      body.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><p>Belum ada riwayat perubahan harga.</p></div>';
    } else {
      const rows = [...data.priceHistory].reverse().slice(0, 60).map((h) => {
        const up = h.change > 0;
        const typeLabel = h.type === "modal" ? "Harga Modal" : h.type === "new" ? "Produk Baru" : "Harga Jual";
        return `<tr>
          <td>${fmtDate(h.changedAt)}</td>
          <td>${escapeHtml(h.productName)}</td>
          <td>${typeLabel}</td>
          <td class="num">${fmtRupiah(h.oldPrice)} → ${fmtRupiah(h.newPrice)}</td>
          <td><span class="pill ${up ? "bad" : "ok"}">${up ? "▲" : "▼"} ${Math.abs(h.percentChange)}%</span></td>
          <td>${escapeHtml(h.changedBy)}</td>
          <td>${escapeHtml(h.reason)}</td>
        </tr>`;
      }).join("");
      body.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Produk</th><th>Tipe</th><th>Perubahan</th><th>%</th><th>Oleh</th><th>Alasan</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    openModal("priceHistoryModal");
  }

  /* ---------------------------------------------------------
     Profit analysis
  --------------------------------------------------------- */
  function renderProfitAnalysis() {
    const tbody = $("profitTableBody");
    tbody.innerHTML = "";
    let totalReal = 0, totalPotential = 0, totalMargin = 0;
    let best = { name: "-", profit: -Infinity };

    const salesByProduct = {};
    data.sales.forEach((s) => {
      const p = findProduct(s.productId);
      const modal = p ? p.modalPrice : s.modalPriceAtSale || 0;
      const entry = salesByProduct[s.productId] || { qty: 0, profit: 0 };
      entry.qty += s.qty;
      entry.profit += (s.price - modal) * s.qty;
      salesByProduct[s.productId] = entry;
    });

    if (data.products.length === 0) {
      $("profitEmptyState").classList.remove("hidden");
      $("profitTableWrap").classList.add("hidden");
    } else {
      $("profitEmptyState").classList.add("hidden");
      $("profitTableWrap").classList.remove("hidden");
    }

    data.products.forEach((p) => {
      const profitUnit = p.price - p.modalPrice;
      const margin = p.modalPrice > 0 ? (profitUnit / p.modalPrice) * 100 : 0;
      const potential = profitUnit * p.stock;
      const sold = salesByProduct[p.id] || { qty: 0, profit: 0 };

      totalReal += sold.profit; totalPotential += potential; totalMargin += margin;
      if (sold.profit > best.profit) best = { name: p.name, profit: sold.profit };

      const cls = profitUnit > 10000 ? "ok" : profitUnit < 3000 ? "bad" : "warn";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td class="num">${fmtRupiah(p.modalPrice)}</td>
        <td class="num">${fmtRupiah(p.price)}</td>
        <td class="num"><span class="pill ${cls}">${fmtRupiah(profitUnit)}</span></td>
        <td class="num">${margin.toFixed(1)}%</td>
        <td class="num">${p.stock}</td>
        <td class="num">${fmtRupiah(potential)}</td>
        <td class="num">${sold.qty}</td>
        <td class="num">${fmtRupiah(sold.profit)}</td>
      `;
      tbody.appendChild(tr);
    });

    $("profitTotalReal").textContent = fmtRupiah(totalReal);
    $("profitTotalPotential").textContent = fmtRupiah(totalPotential);
    $("profitAvgMargin").textContent = data.products.length ? (totalMargin / data.products.length).toFixed(1) + "%" : "0%";
    $("profitBestSeller").textContent = best.profit > -Infinity && best.profit > 0 ? best.name : "-";
  }

  /* ---------------------------------------------------------
     CSV / export helpers
  --------------------------------------------------------- */
  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function toCSV(headers, rows) {
    const escapeCell = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [headers.map(escapeCell).join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");
  }

  function exportProfitCSV() {
    const rows = data.products.map((p) => {
      const profitUnit = p.price - p.modalPrice;
      const margin = p.modalPrice > 0 ? ((profitUnit / p.modalPrice) * 100).toFixed(1) : "0";
      return [p.name, p.modalPrice, p.price, profitUnit, margin + "%", p.stock, profitUnit * p.stock];
    });
    const csv = toCSV(["Produk", "Harga Modal", "Harga Jual", "Keuntungan/Unit", "Margin", "Stok", "Potensi Keuntungan"], rows);
    downloadFile(csv, `analisis-keuntungan-${todayStr()}.csv`, "text/csv");
    toast("Laporan keuntungan (CSV) berhasil diunduh.", "success");
  }

  function exportSalesCSV() {
    const rows = data.sales.map((s) => [fmtDate(s.date), s.name, s.qty, s.price, s.total, s.seller]);
    const csv = toCSV(["Tanggal", "Produk", "Qty", "Harga Jual", "Total", "Kasir"], rows);
    downloadFile(csv, `history-penjualan-${todayStr()}.csv`, "text/csv");
    toast("History penjualan (CSV) berhasil diunduh.", "success");
  }

  function exportSupplierCSV() {
    const rows = data.supplierHistory.map((s) => [fmtDate(s.date), s.productName, s.supplier, s.quantity, s.modalPrice, s.totalCost, s.addedBy]);
    const csv = toCSV(["Tanggal", "Produk", "Supplier", "Qty", "Harga Modal", "Total Biaya", "Ditambahkan Oleh"], rows);
    downloadFile(csv, `restock-supplier-${todayStr()}.csv`, "text/csv");
    toast("Riwayat restock (CSV) berhasil diunduh.", "success");
  }

  function todayStr() { return new Date().toISOString().split("T")[0]; }

  /* ---------------------------------------------------------
     Supplier history
  --------------------------------------------------------- */
  function renderSupplierHistory() {
    const tbody = $("supplierTableBody");
    tbody.innerHTML = "";
    let totalQty = 0, totalSpend = 0;
    const suppliers = new Set();
    const perProduct = {};

    if (data.supplierHistory.length === 0) {
      $("supplierEmptyState").classList.remove("hidden");
      $("supplierTableWrap").classList.add("hidden");
    } else {
      $("supplierEmptyState").classList.add("hidden");
      $("supplierTableWrap").classList.remove("hidden");
    }

    [...data.supplierHistory].reverse().forEach((entry) => {
      totalQty += entry.quantity; totalSpend += entry.totalCost; suppliers.add(entry.supplier);
      perProduct[entry.productName] = (perProduct[entry.productName] || 0) + entry.quantity;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtDate(entry.date)}</td>
        <td>${escapeHtml(entry.productName)}</td>
        <td>${escapeHtml(entry.supplier)}</td>
        <td class="num">${entry.quantity}</td>
        <td class="num">${fmtRupiah(entry.modalPrice)}</td>
        <td class="num">${fmtRupiah(entry.totalCost)}</td>
        <td class="requires-edit-access ${isManagerOrAdmin() ? "" : "hidden"}">
          <button class="btn btn-sm btn-danger" data-action="delete-supplier" data-id="${entry.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    $("supplierTotalRestock").textContent = totalQty.toLocaleString("id-ID");
    $("supplierTotalSpending").textContent = fmtRupiah(totalSpend);
    $("supplierTotalCount").textContent = suppliers.size;
    let top = "-", topQty = 0;
    Object.entries(perProduct).forEach(([name, qty]) => { if (qty > topQty) { top = name; topQty = qty; } });
    $("supplierTopProduct").textContent = top;
  }

  async function deleteSupplierEntry(id) {
    if (!guard()) return;
    const ok = await confirmDialog({ title: "Hapus data restock?", message: "Data restock ini akan dihapus permanen.", confirmText: "Hapus", tone: "danger" });
    if (!ok) return;
    data.supplierHistory = data.supplierHistory.filter((s) => s.id !== id);
    persist("supplierHistory");
    toast("Data restock dihapus.", "success");
    renderSupplierHistory();
  }

  /* ---------------------------------------------------------
     Sales history
  --------------------------------------------------------- */
  function renderSalesHistory(filter = "") {
    const tbody = $("salesHistoryTableBody");
    tbody.innerHTML = "";
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const q = filter.trim().toLowerCase();
    let expiredCount = 0;

    const list = q ? data.sales.filter((s) => s.name.toLowerCase().includes(q) || s.seller.toLowerCase().includes(q)) : data.sales;

    if (data.sales.length === 0) {
      $("salesHistoryEmptyState").classList.remove("hidden");
      $("salesHistoryTableWrap").classList.add("hidden");
    } else {
      $("salesHistoryEmptyState").classList.add("hidden");
      $("salesHistoryTableWrap").classList.remove("hidden");
    }

    [...list].reverse().forEach((sale) => {
      const isExpired = new Date(sale.date).getTime() < cutoff;
      if (new Date(sale.date).getTime() < cutoff) expiredCount++;
      const modal = findProduct(sale.productId)?.modalPrice ?? sale.modalPriceAtSale ?? 0;
      const profit = (sale.price - modal) * sale.qty;

      const tr = document.createElement("tr");
      if (isExpired) tr.classList.add("row-expired");
      tr.innerHTML = `
        <td>${fmtDate(sale.date)}</td>
        <td>${escapeHtml(sale.name)}</td>
        <td class="num">${sale.qty}</td>
        <td class="num">${fmtRupiah(sale.price)}</td>
        <td class="num">${fmtRupiah(modal)}</td>
        <td class="num">${fmtRupiah(profit)}</td>
        <td class="num">${fmtRupiah(sale.total)}</td>
        <td>${escapeHtml(sale.seller)}</td>
        <td><span class="pill ${isExpired ? "bad" : "ok"}">${isExpired ? "Expired" : "Aktif"}</span></td>
      `;
      tbody.appendChild(tr);
    });

    // recompute expired count over full set (not filtered) for the badge
    checkExpiredBadge();
  }

  function checkExpiredBadge() {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const expired = data.sales.filter((s) => new Date(s.date).getTime() < cutoff).length;
    const badge = $("expiredBadge");
    if (expired > 0) { badge.textContent = expired; badge.classList.remove("hidden"); }
    else badge.classList.add("hidden");
  }

  async function clearExpiredSales() {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const expiredCount = data.sales.filter((s) => new Date(s.date).getTime() < cutoff).length;
    if (expiredCount === 0) return toast("Tidak ada data penjualan yang expired.", "info");

    const ok = await confirmDialog({ title: "Hapus data expired?", message: `${expiredCount} transaksi berusia lebih dari 30 hari akan dihapus permanen.`, confirmText: "Hapus Data Expired", tone: "danger" });
    if (!ok) return;
    data.sales = data.sales.filter((s) => new Date(s.date).getTime() >= cutoff);
    persist("sales");
    toast(`${expiredCount} data penjualan expired dihapus.`, "success");
    renderSalesHistory(); renderDashboard();
  }

  /* ---------------------------------------------------------
     Whitelist IP
  --------------------------------------------------------- */
  function renderWhitelist() {
    const tbody = $("whitelistTableBody");
    tbody.innerHTML = "";

    if (data.whitelistIPs.length === 0) {
      $("whitelistEmptyState").classList.remove("hidden");
      $("whitelistTableWrap").classList.add("hidden");
    } else {
      $("whitelistEmptyState").classList.add("hidden");
      $("whitelistTableWrap").classList.remove("hidden");
    }

    data.whitelistIPs.forEach((ip) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(ip.ip)} ${ip.ip === currentIP ? '<span class="pill neutral">IP Anda</span>' : ""}</td>
        <td>${escapeHtml(ip.description)}</td>
        <td>${fmtDate(ip.addedAt)}</td>
        <td>${escapeHtml(ip.addedBy)}</td>
        <td><span class="pill ${ip.status === "active" ? "ok" : "bad"}">${ip.status === "active" ? "Aktif" : "Nonaktif"}</span></td>
        <td class="requires-edit-access ${isManagerOrAdmin() ? "" : "hidden"}">
          <div class="table-actions-cell">
            <button class="btn btn-sm btn-ghost" data-action="toggle-ip" data-id="${ip.ip}">${ip.status === "active" ? "Nonaktifkan" : "Aktifkan"}</button>
            <button class="btn btn-sm btn-danger" data-action="delete-ip" data-id="${ip.ip}"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    $("currentIPDisplay").textContent = currentIP || "-";
    $("whitelistAllowedCount").textContent = activeWhitelist().length;
    $("whitelistBlockedCount").textContent = data.whitelistIPs.filter((ip) => ip.status === "inactive").length;
    const allowed = checkIPAccess();
    $("whitelistAccessStatus").textContent = allowed ? "Diizinkan" : "Diblokir";
    $("whitelistAccessStatus").style.color = allowed ? "var(--success)" : "var(--danger)";
  }

  function openAddIPModal() {
    if (!guard()) return;
    $("newIPForm").reset();
    openModal("addIPModal");
  }

  function saveIP(e) {
    e.preventDefault();
    if (!guard()) return;
    const ip = $("newIPAddress").value.trim();
    const description = $("newIPDescription").value.trim();
    const status = $("newIPStatus").value;

    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return toast("Format IP address tidak valid.", "warning");
    if (data.whitelistIPs.some((w) => w.ip === ip)) return toast("IP tersebut sudah ada di whitelist.", "warning");

    data.whitelistIPs.push({ ip, description: description || "Tidak ada deskripsi", status, addedBy: currentUser.name, addedAt: new Date().toISOString() });
    persist("whitelistIPs");
    closeModal("addIPModal");
    toast(`IP ${ip} ditambahkan ke whitelist.`, "success");
    renderWhitelist();
  }

  function toggleIPStatus(ip) {
    if (!guard()) return;
    const entry = data.whitelistIPs.find((w) => w.ip === ip);
    if (!entry) return;
    entry.status = entry.status === "active" ? "inactive" : "active";
    persist("whitelistIPs");
    renderWhitelist();
  }

  async function removeIP(ip) {
    if (!guard()) return;
    const ok = await confirmDialog({ title: "Hapus dari whitelist?", message: `IP ${ip} akan dihapus dari daftar whitelist.`, confirmText: "Hapus", tone: "danger" });
    if (!ok) return;
    data.whitelistIPs = data.whitelistIPs.filter((w) => w.ip !== ip);
    persist("whitelistIPs");
    toast("IP dihapus dari whitelist.", "success");
    renderWhitelist();
  }

  /* ---------------------------------------------------------
     Settings: backup / restore / reset
  --------------------------------------------------------- */
  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), data };
    downloadFile(JSON.stringify(payload, null, 2), `grosirku-backup-${todayStr()}.json`, "application/json");
    toast("Backup data berhasil diunduh.", "success");
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed.data || parsed;
        const ok = await confirmDialog({ title: "Timpa data saat ini?", message: "Semua data (produk, penjualan, riwayat) akan digantikan dengan isi file backup ini.", confirmText: "Timpa Data", tone: "danger" });
        if (!ok) return;
        STORAGE_KEYS.forEach((key) => {
          data[key] = Array.isArray(incoming[key]) ? incoming[key] : data[key];
          persist(key);
        });
        toast("Data berhasil dipulihkan dari backup.", "success");
        renderAll();
      } catch {
        toast("File backup tidak valid.", "error");
      }
    };
    reader.readAsText(file);
  }

  async function resetToSampleData() {
    const ok = await confirmDialog({ title: "Reset ke data contoh?", message: "Seluruh data saat ini akan dihapus dan digantikan dengan data contoh awal.", confirmText: "Reset Data", tone: "danger" });
    if (!ok) return;
    STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    location.reload();
  }

  /* ---------------------------------------------------------
     Event wiring
  --------------------------------------------------------- */
  function wireEvents() {
    $("loginForm").addEventListener("submit", login);
    $("togglePasswordBtn").addEventListener("click", () => {
      const input = $("loginPassword");
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      $("togglePasswordBtn").innerHTML = `<i class="fa-solid ${showing ? "fa-eye" : "fa-eye-slash"}"></i>`;
    });

    $("mobileMenuBtn").addEventListener("click", toggleSidebar);
    $("sidebarOverlay").addEventListener("click", closeSidebar);
    $("logoutBtn").addEventListener("click", logout);
    $("themeToggleBtn").addEventListener("click", toggleTheme);
    document.querySelectorAll(".theme-option").forEach((el) => el.addEventListener("click", () => applyTheme(el.dataset.theme)));

    document.querySelectorAll(".side-nav li").forEach((li) => li.querySelector("button").addEventListener("click", () => showSection(li.dataset.section)));

    $("productSidebarSearch").addEventListener("input", (e) => renderProducts(e.target.value));
    $("productsTableSearch").addEventListener("input", (e) => renderProducts(e.target.value));
    $("salesHistorySearch").addEventListener("input", (e) => renderSalesHistory(e.target.value));

    $("addProductBtn").addEventListener("click", openAddProductModal);
    $("newProductForm").addEventListener("submit", saveNewProduct);

    $("saleForm").addEventListener("submit", sellProduct);

    $("priceHistoryBtn").addEventListener("click", openPriceHistoryModal);

    $("editPriceForm").addEventListener("submit", savePriceChange);
    wirePriceDiffLive("editPriceNewInput", () => parseInt($("editPriceOldValue").textContent.replace(/\D/g, ""), 10), "editPriceDiffPreview");

    $("editModalCostForm").addEventListener("submit", saveModalPriceChange);
    wirePriceDiffLive("editModalCostNewInput", () => parseInt($("editModalCostOldValue").textContent.replace(/\D/g, ""), 10), "editModalCostDiffPreview");

    $("restockForm").addEventListener("submit", addStock);

    $("exportProfitCsvBtn").addEventListener("click", exportProfitCSV);
    $("exportSalesCsvBtn").addEventListener("click", exportSalesCSV);
    $("exportSupplierCsvBtn").addEventListener("click", exportSupplierCSV);
    $("clearExpiredBtn").addEventListener("click", clearExpiredSales);

    $("addIPBtn").addEventListener("click", openAddIPModal);
    $("newIPForm").addEventListener("submit", saveIP);

    $("printReceiptBtn").addEventListener("click", printReceipt);

    $("exportBackupBtn").addEventListener("click", exportBackup);
    $("importBackupInput").addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });
    $("resetSampleDataBtn").addEventListener("click", resetToSampleData);

    // Delegated clicks for dynamic table action buttons
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const { action, id } = btn.dataset;
      const map = {
        "edit-price": () => openEditPriceModal(id),
        "edit-modal": () => openEditModalPriceModal(id),
        "restock": () => openAddStockModal(id),
        "delete-product": () => deleteProduct(id),
        "delete-supplier": () => deleteSupplierEntry(id),
        "toggle-ip": () => toggleIPStatus(id),
        "delete-ip": () => removeIP(id),
      };
      if (map[action]) map[action]();
    });

    document.querySelectorAll("[data-close-modal]").forEach((el) => el.addEventListener("click", () => closeModal(el.dataset.closeModal)));
    document.querySelectorAll(".modal-overlay").forEach((overlay) => overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.classList.remove("is-visible"); }));

    window.addEventListener("resize", () => { if (window.innerWidth > 1024) closeSidebar(); });
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    wireEvents();
    checkAuth();
  });
})();
