import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';

const db = getFirestore();

const parseProductData = (data) => {
  const parsed = { ...data };
  if (parsed.price && typeof parsed.price === 'string') {
    parsed.price = parseFloat(parsed.price.replace(',', '.')) || 0;
  }
  if (parsed.cost_price && typeof parsed.cost_price === 'string') {
    parsed.cost_price = parseFloat(parsed.cost_price.replace(',', '.')) || 0;
  }
  if (parsed.stock_quantity && typeof parsed.stock_quantity === 'string') {
    parsed.stock_quantity = parseInt(parsed.stock_quantity, 10) || 0;
  }
   if (parsed.low_stock_threshold && typeof parsed.low_stock_threshold === 'string') {
    parsed.low_stock_threshold = parseInt(parsed.low_stock_threshold, 10) || 5;
  }
   if (parsed.administrationPrice && typeof parsed.administrationPrice === 'string') {
     const val = parseFloat(parsed.administrationPrice.replace(',', '.'));
     parsed.administrationPrice = isNaN(val) ? null : val; 
   } else if (parsed.administrationPrice === '') {
      parsed.administrationPrice = null;
   }

  parsed.allowInternalUse = !!parsed.allowInternalUse;

  return parsed;
};

export const productService = {
  create: async (/* tenantId, */ productData) => {
    const tenantId = productData?.tenant_id; 
    if (!tenantId) {
      throw new Error("Tenant ID (tenant_id) é obrigatório nos dados para criar um produto.");
    }
    if (!productData.module || (productData.module !== 'clinica' && productData.module !== 'petshop')) {
       console.warn("Product data received in create:", productData);
       throw new Error("O campo 'module' ('clinica' ou 'petshop') é obrigatório.");
    }
     if (!productData.name || !productData.category || productData.price === undefined || productData.price === null) {
       console.warn("Product data received in create:", productData);
       throw new Error("Nome, Categoria e Preço são obrigatórios.");
     }

    const parsedData = parseProductData(productData);
    const productsColRef = collection(db, 'tenants', tenantId, 'products');

    const dataToSave = { ...parsedData };

    console.log("[productService.create] Saving data:", dataToSave);
    return await addDoc(productsColRef, {
      ...dataToSave,
      tenant_id: tenantId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  filter: async (filterObject) => {
    let tenantId = filterObject?.tenant_id;
    if (!tenantId) {
      console.warn("[productService.filter] Tenant ID não fornecido no filtro, tentando localStorage...");
      tenantId = localStorage.getItem('current_tenant');
    }
    
    if (!tenantId) {
      throw new Error("Tenant ID (tenant_id) é obrigatório no objeto de filtro ou localStorage para buscar produtos.");
    }
    
    console.log("[productService.filter] Filtering for tenant:", tenantId, "with options:", filterObject);

    const { 
      module: filterModule,
      allowInternalUse: filterAllowInternalUse,
      category: filterCategory,
      searchTerm: _filterSearchTerm,
      orderByField = 'name',
      orderByDirection = 'asc',
      limitNum,
      startAfterDoc
    } = filterObject;

    const productsColRef = collection(db, 'tenants', tenantId, 'products');
    let queryConstraints = [];

    if (filterModule && (filterModule === 'clinica' || filterModule === 'petshop')) {
      console.log("[productService.filter] Adding module filter:", filterModule);
      queryConstraints.push(where('module', '==', filterModule));
    }

    if (filterCategory && filterCategory !== 'all') {
      console.log("[productService.filter] Adding category filter:", filterCategory);
      queryConstraints.push(where('category', '==', filterCategory));
    }

    if (Object.prototype.hasOwnProperty.call(filterObject, 'allowInternalUse')) {
        console.log("[productService.filter] Adding allowInternalUse filter:", filterAllowInternalUse);
        queryConstraints.push(where('allowInternalUse', '==', Boolean(filterAllowInternalUse)));
    }

    queryConstraints.push(orderBy(orderByField, orderByDirection));

    if (startAfterDoc) {
      queryConstraints.push(startAfter(startAfterDoc));
    }

    if (limitNum) {
      queryConstraints.push(limit(limitNum));
    }

    const q = query(productsColRef, ...queryConstraints);
    const snapshot = await getDocs(q);
    
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    console.log("[productService.filter] Found products:", results.length);
    return { products: results, lastVisibleDoc: lastVisible };
  },

  getCount: async (filterObject) => {
    let tenantId = filterObject?.tenant_id;
    if (!tenantId) {
      tenantId = localStorage.getItem('current_tenant');
    }
    if (!tenantId) {
      throw new Error("Tenant ID (tenant_id) é obrigatório para getCount.");
    }

    const { 
      module: filterModule,
      allowInternalUse: filterAllowInternalUse,
      category: filterCategory,
      searchTerm: _filterSearchTerm
    } = filterObject;

    const productsColRef = collection(db, 'tenants', tenantId, 'products');
    const queryConstraints = [];

    if (filterModule && (filterModule === 'clinica' || filterModule === 'petshop')) {
      queryConstraints.push(where('module', '==', filterModule));
    }
    if (filterCategory && filterCategory !== 'all') {
      queryConstraints.push(where('category', '==', filterCategory));
    }

    if (Object.prototype.hasOwnProperty.call(filterObject, 'allowInternalUse')) {
      queryConstraints.push(where('allowInternalUse', '==', Boolean(filterAllowInternalUse)));
    }

    const q = query(productsColRef, ...queryConstraints);
    const snapshot = await getCountFromServer(q);
    console.log("[productService.getCount] Total products for filter:", snapshot.data().count, filterObject);
    return snapshot.data().count;
  },

  getAllByTenant: async (tenantId) => {
     if (!tenantId) {
       throw new Error("Tenant ID é obrigatório para buscar todos os produtos.");
     }
     return productService.filter({ tenant_id: tenantId }); 
  },

  update: async (tenantId, productId, productData) => {
    if (!tenantId || !productId) {
      throw new Error("Tenant ID e Product ID são obrigatórios para atualizar.");
    }
    
    const dataToUpdate = { ...parseProductData(productData) };
    delete dataToUpdate.tenant_id; 

    const productDocRef = doc(db, 'tenants', tenantId, 'products', productId);
    
    console.log("[productService.update] Updating doc:", productDocRef.path, "with data:", dataToUpdate);
    return await updateDoc(productDocRef, {
       ...dataToUpdate,
       updatedAt: serverTimestamp(),
     });
  },

  delete: async (productId) => {
    if (!productId) {
      throw new Error("Product ID é obrigatório para deletar.");
    }
    throw new Error("productService.delete precisa receber tenantId e productId."); 
  },

  deleteWithTenant: async (tenantId, productId) => {
     if (!tenantId || !productId) {
       throw new Error("Tenant ID e Product ID são obrigatórios para deletar.");
     }
     const productDocRef = doc(db, 'tenants', tenantId, 'products', productId);
     console.log("[productService.delete] Deleting doc:", productDocRef.path);
     return await deleteDoc(productDocRef);
   },

  getById: async (tenantId, productId) => {
     if (!tenantId || !productId) {
       throw new Error("Tenant ID e Product ID são obrigatórios para buscar por ID.");
     }
     const productDocRef = doc(db, 'tenants', tenantId, 'products', productId);
     const docSnap = await getDoc(productDocRef);
     if (docSnap.exists()) {
       return { id: docSnap.id, ...docSnap.data() };
     } else {
       return null;
     }
   },
}; 