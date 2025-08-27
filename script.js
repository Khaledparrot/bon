// ===========================
// CONFIGURATION
// ===========================
const API_URL = 'https://factures-api.onrender.com'; // ← Change if your URL is different

// Track state
let currentCustomerId = null;
let editingInvoiceId = null;

// DOM Elements
const modal = document.getElementById('modal');
const imageModal = document.getElementById('imageModal');
const fullImage = document.getElementById('fullImage');

// ===========================
// HELPERS
// ===========================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===========================
// CUSTOMERS: Load, Add, Delete
// ===========================

// Load all customers
async function loadCustomers() {
  try {
    const res = await fetch(`${API_URL}/api/customers`);
    if (!res.ok) throw new Error("Failed to load");

    const customers = await res.json();
    const customerList = document.getElementById('customerList');
    customerList.innerHTML = '';

    customers.forEach(customer => {
      const li = document.createElement('li');
      li.style.position = 'relative';
      li.style.padding = '12px 40px 12px 12px';
      li.style.borderBottom = '1px solid #eee';
      li.style.fontFamily = 'Arial, sans-serif';

      li.innerHTML = `
        <strong style="font-size: 16px; color: #333;">${escapeHtml(customer.name)}</strong>
        <div style="
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          gap: 6px;
          z-index: 10;
        ">
          <button 
            type="button" 
            onclick="viewInvoices(${customer.id}, '${escapeHtml(customer.name).replace(/'/g, "\\'")}')"
            style="
              width: 30px;
              height: 30px;
              border: none;
              background: #f5f5f5;
              border-radius: 6px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            "
            title="Voir les factures">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#1976d2">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
          </button>
          <button 
            type="button" 
            onclick="deleteCustomer(${customer.id})"
            style="
              width: 30px;
              height: 30px;
              border: none;
              background: #f5f5f5;
              border-radius: 6px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0;
              transition: all 0.2s ease;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            "
            title="Supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#d32f2f">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      `;

      customerList.appendChild(li);
    });
  } catch (err) {
    console.error("Load customers error:", err);
    document.getElementById('customerList').innerHTML = '<li style="color: red;">Erreur de chargement</li>';
  }
}

// Add new customer
document.getElementById('addCustomerBtn').onclick = async () => {
  const name = prompt("Nom du client :");
  if (name && name.trim()) {
    try {
      await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      loadCustomers();
    } catch (err) {
      alert("Échec de l'ajout du client");
    }
  }
};

// Delete customer
async function deleteCustomer(id) {
  if (!confirm("Supprimer ce client et toutes ses factures ?")) return;

  try {
    await fetch(`${API_URL}/api/customers/${id}`, { method: 'DELETE' });
    loadCustomers();
    if (currentCustomerId === id) {
      document.getElementById('invoiceSection').style.display = 'none';
      currentCustomerId = null;
    }
  } catch (err) {
    alert("Échec de la suppression");
  }
}

// ===========================
// INVOICES: Load, Add, Edit, Delete
// ===========================

// View invoices for a customer
function viewInvoices(customerId, name) {
  const invoiceSection = document.getElementById('invoiceSection');
  const isCurrentlyVisible = window.getComputedStyle(invoiceSection).display !== 'none';

  if (isCurrentlyVisible && currentCustomerId === customerId) {
    invoiceSection.style.display = 'none';
    currentCustomerId = null;
  } else {
    currentCustomerId = customerId;
    document.getElementById('customerNameHeader').textContent = `Factures: ${name}`;
    invoiceSection.style.display = 'block';
    loadInvoices(customerId);
  }
}

// Load invoices for customer
async function loadInvoices(customerId) {
  try {
    const res = await fetch(`${API_URL}/api/invoices?customer_id=${customerId}`);
    if (!res.ok) throw new Error("Failed to load");

    const invoices = await res.json();
    const list = document.getElementById('invoiceList');
    list.innerHTML = '';

    invoices.forEach(inv => {
      const total = inv.items?.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) || inv.amount || 0;
      const escapedTitle = escapeHtml(inv.title || 'Sans titre');
      const photoUrl = inv.photo_url ? escapeHtml(inv.photo_url) : '';

      let imageButton = '';
      if (photoUrl) {
        imageButton = `
          <button type="button" onclick="viewImage('${photoUrl}')" title="Voir la photo">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        `;
      }

      const li = document.createElement('li');
      li.innerHTML = `
        <div class="invoice-item">
          <div class="invoice-header">
            <span class="invoice-title">${escapedTitle}</span>
            <span class="invoice-price">${total.toFixed(2)} DZD</span>
          </div>
          <div class="invoice-date">${inv.date}</div>
          <div class="invoice-actions">
            <button type="button" onclick="editInvoice(${inv.id})" title="Modifier">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-5 1 1-5L15.5 3.5z"></path>
              </svg>
            </button>
            <button type="button" onclick="deleteInvoice(${inv.id})" title="Supprimer" style="color: #d9534f;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            ${imageButton}
          </div>
        </div>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Load invoices error:", err);
  }
}

// Add/Edit Invoice
document.getElementById('addInvoiceBtn').onclick = () => {
  editingInvoiceId = null;
  document.getElementById('modalTitle').textContent = "Nouvelle Facture";
  document.getElementById('invoiceForm').reset();
  document.getElementById('itemsContainer').innerHTML = `
    <h4>Articles</h4>
    <div class="item-row">
      <input type="text" placeholder="Description" class="item-desc" />
      <input type="number" placeholder="Prix" class="item-price" step="0.01" />
    </div>
  `;
  document.getElementById('photoPreview').innerHTML = '';
  modal.style.display = 'block';
};

// Add more items
document.getElementById('addItemBtn').onclick = () => {
  const container = document.getElementById('itemsContainer');
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" placeholder="Description" class="item-desc" />
    <input type="number" placeholder="Prix" class="item-price" step="0.01" />
  `;
  container.appendChild(row);
};

// Photo preview
document.getElementById('invoicePhoto').onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('photoPreview').innerHTML = `
        <img src="${reader.result}" style="max-width:100%; max-height:200px; border-radius:8px; margin:10px 0;" />
      `;
    };
    reader.readAsDataURL(file);
  }
};

// Save Invoice (Add or Edit)
document.getElementById('invoiceForm').onsubmit = async (e) => {
  e.preventDefault();

  const title = document.getElementById('invoiceTitle').value;
  const amount = parseFloat(document.getElementById('invoiceAmount').value) || 0;
  const date = document.getElementById('invoiceDate').value;

  const items = [];
  document.querySelectorAll('.item-row').forEach(row => {
    const desc = row.querySelector('.item-desc').value;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (desc) items.push({ desc, price });
  });

  let photoUrl = null;
  const photoInput = document.getElementById('invoicePhoto');
  if (photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = async () => {
      photoUrl = reader.result;
      await saveInvoiceToAPI(title, amount, date, items, photoUrl);
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    await saveInvoiceToAPI(title, amount, date, items, photoUrl);
  }
};

// Save to API
async function saveInvoiceToAPI(title, amount, date, items, photoUrl) {
  const invoiceData = {
    customer_id: currentCustomerId,
    title,
    amount,
    date,
    items,
    photo_url: photoUrl
  };

  const url = editingInvoiceId
    ? `${API_URL}/api/invoices/${editingInvoiceId}`
    : `${API_URL}/api/invoices`;
  const method = editingInvoiceId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData)
    });

    if (!res.ok) throw new Error("Save failed");

    modal.style.display = 'none';
    loadInvoices(currentCustomerId);
  } catch (err) {
    alert("Échec de la sauvegarde");
  }
}

// Edit Invoice
async function editInvoice(id) {
  try {
    const res = await fetch(`${API_URL}/api/invoices/${id}`);
    if (!res.ok) throw new Error("Not found");

    const inv = await res.json();
    editingInvoiceId = inv.id;

    document.getElementById('invoiceTitle').value = inv.title;
    document.getElementById('invoiceAmount').value = inv.amount;
    document.getElementById('invoiceDate').value = inv.date;

    const itemsContainer = document.getElementById('itemsContainer');
    itemsContainer.innerHTML = '<h4>Articles</h4>';
    inv.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(item.desc)}" class="item-desc" />
        <input type="number" value="${item.price}" class="item-price" step="0.01" />
      `;
      itemsContainer.appendChild(row);
    });

    const photoPreview = document.getElementById('photoPreview');
    photoPreview.innerHTML = '';
    if (inv.photo_url) {
      const img = document.createElement('img');
      img.src = inv.photo_url;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '200px';
      img.style.borderRadius = '8px';
      img.style.margin = '10px 0';
      photoPreview.appendChild(img);
    }

    document.getElementById('modalTitle').textContent = "Modifier Facture";
    modal.style.display = 'block';
  } catch (err) {
    alert("Erreur de chargement de la facture");
  }
}

// Delete Invoice
async function deleteInvoice(id) {
  if (!confirm("Supprimer cette facture ?")) return;

  try {
    await fetch(`${API_URL}/api/invoices/${id}`, { method: 'DELETE' });
    loadInvoices(currentCustomerId);
  } catch (err) {
    alert("Échec de la suppression");
  }
}

// ===========================
// IMAGE VIEWER
// ===========================
function viewImage(src) {
  fullImage.src = src;
  imageModal.style.display = 'block';
}

// Close modals
document.querySelectorAll('.close').forEach(btn => {
  btn.onclick = () => {
    modal.style.display = 'none';
    imageModal.style.display = 'none';
  };
});

window.onclick = (e) => {
  if (e.target === modal || e.target === imageModal) {
    modal.style.display = 'none';
    imageModal.style.display = 'none';
  }
};

// ===========================
// INIT
// ===========================
// Load customers on start
window.onload = loadCustomers;
