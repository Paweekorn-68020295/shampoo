// ==========================================================================
// Body Scent - Shared Script (script.js)
// ==========================================================================

const APPS_SCRIPT_URL = '[APPS_SCRIPT_URL]';
const CSV_URL = '[CSV_URL]';

document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});

// ==========================================================================
// 1. หน้าแสดงสินค้า (product.html)
// ==========================================================================
let allProducts = [];

async function initProductPage() {
  const productList = document.getElementById('product-list');
  if (!productList) return;

  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลสินค้าได้');
    allProducts = await response.json();

    const urlParams = new URLSearchParams(window.location.search);
    const initialMood = (urlParams.get('mood') || 'all').toLowerCase();

    setupFilterBar(initialMood);
    filterAndRenderProducts(initialMood);
  } catch (error) {
    console.error('Error loading products:', error);
    productList.innerHTML = `<p style="text-align:center; grid-column: 1/-1;">เกิดข้อผิดพลาดในการโหลดรายการสินค้า</p>`;
  }
}

function setupFilterBar(activeMood) {
  const filterBar = document.getElementById('filter-bar');
  if (!filterBar) return;

  const filterButtons = filterBar.querySelectorAll('.filter-btn, [data-mood]');
  if (!filterButtons.length) return;

  filterButtons.forEach((btn) => {
    const btnMood = (btn.dataset.mood || 'all').toLowerCase();

    if (btnMood === activeMood) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }

    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const selectedMood = (btn.dataset.mood || 'all').toLowerCase();
      filterAndRenderProducts(selectedMood);

      const newUrl = new URL(window.location);
      if (selectedMood === 'all') {
        newUrl.searchParams.delete('mood');
      } else {
        newUrl.searchParams.set('mood', selectedMood);
      }
      window.history.replaceState({}, '', newUrl);
    });
  });
}

function filterAndRenderProducts(mood) {
  const filtered =
    mood === 'all' || !mood
      ? allProducts
      : allProducts.filter((p) => (p.mood || '').toLowerCase() === mood);

  renderProductCards(filtered);
}

function renderProductCards(products) {
  const productList = document.getElementById('product-list');
  if (!productList) return;

  if (!products.length) {
    productList.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color: var(--text-muted);">ไม่พบสินค้าในหมวดหมู่นี้</p>`;
    return;
  }

  productList.innerHTML = products
    .map((product) => {
      const moodKey = (product.mood || '').toLowerCase();
      const moodLabel = moodKey.charAt(0).toUpperCase() + moodKey.slice(1);
      const itemFullName = product.size ? `${product.name} ${product.size}` : product.name;
      const orderUrl = `order.html?item=${encodeURIComponent(itemFullName)}&price=${encodeURIComponent(product.price)}`;

      return `
        <article class="product-card">
          <div class="product-image">
            <img src="${product.image}" alt="${product.name}" loading="lazy">
          </div>
          <div class="product-info">
            <div class="product-meta">
              <span class="mood-tag" data-mood="${moodKey}">
                <span class="mood-dot mood-dot--${moodKey}"></span>
                ${moodLabel}
              </span>
              <span class="product-size">${product.size || ''}</span>
            </div>
            <h3 class="product-title">${product.name}</h3>
            <p class="product-desc">${product.description || ''}</p>
            <div class="product-footer">
              <span class="product-price">฿${Number(product.price).toLocaleString()}</span>
              <a href="${orderUrl}" class="btn btn--sm">สั่งซื้อ</a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

// ==========================================================================
// 2. หน้าสั่งซื้อสินค้า (order.html)
// ==========================================================================
function initOrderPage() {
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');
  const orderForm = document.getElementById('orderForm');

  if (!itemsInput && !totalInput && !orderForm) return;

  // อ่านค่า item และ price จาก URL parameter แล้วเติมลงฟอร์มอัตโนมัติทันทีที่โหลดหน้า
  const urlParams = new URLSearchParams(window.location.search);
  const itemParam = urlParams.get('item');
  const priceParam = urlParams.get('price');

  if (itemParam !== null && itemsInput) {
    itemsInput.value = itemParam;
  }
  if (priceParam !== null && totalInput) {
    totalInput.value = priceParam;
  }

  // จัดการการส่งข้อมูลเมื่อกดปุ่มยืนยันสั่งซื้อ
  if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitBtn = orderForm.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังส่งคำสั่งซื้อ...';
      }

      const payload = {
        customerName: (document.getElementById('customerName')?.value || '').trim(),
        contact: (document.getElementById('contact')?.value || '').trim(),
        items: (document.getElementById('items')?.value || '').trim(),
        total: (document.getElementById('total')?.value || '').trim(),
        note: (document.getElementById('note')?.value || '').trim()
      };

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'ยืนยันสั่งซื้อ';
        }
      });
    });
  }
}

// ==========================================================================
// 3. หน้าแอดมิน (admin.html) - ดึงข้อมูลจาก CSV และเรียงล่าสุดขึ้นก่อน
// ==========================================================================
async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error('ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้');

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    // ตัดแถวหัวตาราง (row แรก) ออก และกรองแถวว่างทิ้ง
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim() !== ''));

    if (!dataRows.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">ยังไม่มีรายการคำสั่งซื้อ</td></tr>`;
      return;
    }

    // เรียงจากรายการล่าสุดขึ้นก่อน (กลับลำดับจากล่างขึ้นบนของ Sheet)
    const latestFirstRows = dataRows.reverse();

    tbody.innerHTML = latestFirstRows
      .map((cols) => {
        const timestamp = escapeHTML(cols[0] || '-');
        const customerName = escapeHTML(cols[1] || '-');
        const contact = escapeHTML(cols[2] || '-');
        const items = escapeHTML(cols[3] || '-');
        const total = cols[4] ? `฿${Number(cols[4]).toLocaleString()}` : '-';
        const note = escapeHTML(cols[5] || '-');

        return `
          <tr>
            <td>${timestamp}</td>
            <td>${customerName}</td>
            <td>${contact}</td>
            <td>${items}</td>
            <td>${escapeHTML(total)}</td>
            <td>${note}</td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    console.error('Error loading orders CSV:', error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #B86B6B;">เกิดข้อผิดพลาดในการโหลดข้อมูลคำสั่งซื้อ</td></tr>`;
  }
}

// ฟังก์ชัน Parse CSV เอง (รองรับเครื่องหมายคำพูด "..." ลูกน้ำในข้อความ และการขึ้นบรรทัดใหม่ในเซลล์)
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  // แปลง \r\n เป็น \n เพื่อความสม่ำเสมอ
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // กรณีเครื่องหมายคำพูดซ้อน "" แทนเครื่องหมาย " 1 ตัว
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // เก็บข้อมูลตัวสุดท้าย (กรณีไฟล์ไม่ได้ลงท้ายด้วย \n)
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
