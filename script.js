let db;
const DB_NAME = 'FacturesDB';
const VERSION = 1;

// Open IndexedDB
function openDB() {
  const request = indexedDB.open(DB_NAME, VERSION);

  request.onupgradeneeded = (e) => {
    db = e.target.result;

    // Customers Store
    if (!db.objectStoreNames.contains('customers')) {
      const customerStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      customerStore.createIndex('name', 'name', { unique: false });
    }

    // Invoices Store
    if (!db.objectStoreNames.contains('invoices')) {
      const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
      invoiceStore.createIndex('customerId', 'customerId', { unique: false });
    }
  };

  request.onsuccess = (e) => {
    db = e.target.result;
    loadCustomers();
  };

  request.onerror = (e) => {
    console.error("DB Error:", e.target.error);
  };
}

// Load all customers
function loadCustomers() {
  const tx = db.transaction('customers', 'readonly');
  const store = tx.objectStore('customers');
  const request = store.getAll();

  request.onsuccess = () => {
    const customerList = document.getElementById('customerList');
    customerList.innerHTML = '';

    request.result.forEach(customer => {
      const li = document.createElement('li');
      li.innerHTML = `
        ${customer.name}
        <button onclick="deleteCustomer(${customer.id})" style="float:right; color:#d32f2f; border:none; background:none; padding:0; width:28px; height:28px;" title="Supprimer">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
</button>
<button onclick="viewInvoices(${customer.id}, '${customer.name}')" style="float:right; margin-right:10px; color:#1976d2; border:none; background:none; padding:0; width:28px; height:28px;" title="Voir les factures">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
  </svg>
</button>
      `;
      customerList.appendChild(li);
    });
  };
}

// Add new customer
document.getElementById('addCustomerBtn').onclick = () => {
  const name = prompt("Nom du client :");
  if (name && name.trim()) {
    const tx = db.transaction('customers', 'readwrite');
    const store = tx.objectStore('customers');
    store.add({ name: name.trim(), createdAt: new Date().toISOString() });
    tx.oncomplete = loadCustomers;
  }
};

// Delete customer
function deleteCustomer(id) {
  if (!confirm("Supprimer ce client et toutes ses factures ?")) return;

  const tx = db.transaction(['customers', 'invoices'], 'readwrite');
  const customerStore = tx.objectStore('customers');
  const invoiceStore = tx.objectStore('invoices');

  customerStore.delete(id);
  const invoiceIndex = invoiceStore.index('customerId');
  invoiceIndex.openCursor(IDBKeyRange.only(id)).onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      invoiceStore.delete(cursor.value.id);
      cursor.continue();
    }
  };

  tx.oncomplete = loadCustomers;
}

// View or hide invoices for a customer
function viewInvoices(customerId, name) {
  const invoiceSection = document.getElementById('invoiceSection');

  // Get the actual display value (not just inline style)
  const isCurrentlyVisible = window.getComputedStyle(invoiceSection).display !== 'none';

  // If already open for this customer → close it
  if (isCurrentlyVisible && currentCustomerId === customerId) {
    invoiceSection.style.display = 'none';
    currentCustomerId = null;
  }
  // If clicking a different customer or currently closed → open it
  else {
    currentCustomerId = customerId;
    document.getElementById('customerNameHeader').textContent = `Factures: ${name}`;
    invoiceSection.style.display = 'block'; // Ensure it's block
    loadInvoices(customerId);
  }
}

let currentCustomerId = null;
let editingInvoiceId = null;
const modal = document.getElementById('modal');
const imageModal = document.getElementById('imageModal');
const fullImage = document.getElementById('fullImage');

// Load invoices for customer

function loadInvoices(customerId) {
  const tx = db.transaction('invoices', 'readonly');
  const store = tx.objectStore('invoices');
  const index = store.index('customerId');
  const request = index.getAll(customerId);

  request.onsuccess = () => {
    const list = document.getElementById('invoiceList');
    list.innerHTML = '';

    request.result.forEach(inv => {
      const li = document.createElement('li');

      // Calculate total
      const total = inv.items?.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0),
        0
      ) || inv.amount || 0;

      // Escape title
      const escapedTitle = (inv.title || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '<')
        .replace(/>/g, '>');

      // Escape photoUrl for use in attribute
      const photoUrl = inv.photoUrl
        ? inv.photoUrl.replace(/'/g, '&#x27;')
        : '';

      // Build HTML as a string without nested template issues
      let imageButton = '';
      if (photoUrl) {
        imageButton = `
          <button type="button" onclick="viewImage('${photoUrl}')" aria-label="View Invoice Image" title="View Photo">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
        `;
      }

      li.innerHTML = `
        <div class="invoice-item">
          <div class="invoice-header">
            <span class="invoice-title">${escapedTitle}</span>
            <span class="invoice-price">${total.toFixed(2)} DZD</span>
          </div>
          <div class="invoice-date">${inv.date}</div>
          <div class="invoice-actions">
            <button type="button" onclick="editInvoice(${inv.id})" aria-label="Edit Invoice" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-5 1 1-5L15.5 3.5z"></path>
              </svg>
            </button>
            <button type="button" onclick="deleteInvoice(${inv.id})" aria-label="Delete Invoice" title="Delete" style="color: #d9534f;">
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
  };

  request.onerror = () => {
    console.error('Failed to load invoices:', request.error);
  };
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

// Handle photo preview
document.getElementById('invoicePhoto').onchange = (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('photoPreview').innerHTML = `<img src="${reader.result}" />`;
    };
    reader.readAsDataURL(file);
  }
};

// Save Invoice
document.getElementById('invoiceForm').onsubmit = (e) => {
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

  const photoInput = document.getElementById('invoicePhoto');
  let photoUrl = null;
  if (photoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = function() {
      photoUrl = reader.result;
      saveInvoiceToDB();
    };
    reader.readAsDataURL(photoInput.files[0]);
  } else {
    photoUrl = null;
    saveInvoiceToDB();
  }

  function saveInvoiceToDB() {
    const tx = db.transaction('invoices', 'readwrite');
    const store = tx.objectStore('invoices');

    const invoiceData = {
      customerId: currentCustomerId,
      title,
      amount,
      date,
      items,
      photoUrl,
    };

    if (editingInvoiceId) {
      invoiceData.id = editingInvoiceId;
      store.put(invoiceData);
    } else {
      store.add(invoiceData);
    }

    tx.oncomplete = () => {
      modal.style.display = 'none';
      loadInvoices(currentCustomerId);
    };
  }
};

// Edit Invoice
function editInvoice(id) {
  const tx = db.transaction('invoices', 'readonly');
  const store = tx.objectStore('invoices');
  const request = store.get(id);

  request.onsuccess = () => {
    const inv = request.result;
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
        <input type="text" value="${item.desc}" class="item-desc" />
        <input type="number" value="${item.price}" class="item-price" step="0.01" />
      `;
      itemsContainer.appendChild(row);
    });

    document.getElementById('photoPreview').innerHTML = inv.photoUrl ? `<img src="${inv.photoUrl}" />` : '';
    document.getElementById('modalTitle').textContent = "Modifier Facture";
    modal.style.display = 'block';
  };
}

// Delete Invoice
function deleteInvoice(id) {
  if (confirm("Supprimer cette facture ?")) {
    const tx = db.transaction('invoices', 'readwrite');
    tx.objectStore('invoices').delete(id);
    tx.oncomplete = () => loadInvoices(currentCustomerId);
  }
}

// View Image (Zoom)
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

// Initialize DB

openDB();







