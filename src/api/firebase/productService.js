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
    const tenantId = filterObject?.tenant_id;
    if (!tenantId) {
      throw new Error("Tenant ID (tenant_id) é obrigatório no objeto de filtro para buscar produtos.");
    }
    
    console.log("[productService.filter] Filtering for tenant:", tenantId, "with options:", filterObject);

    const productsColRef = collection(db, 'tenants', tenantId, 'products');
    const queryConstraints = [];

    if (filterObject.module && (filterObject.module === 'clinica' || filterObject.module === 'petshop')) {
      console.log("[productService.filter] Adding module filter:", filterObject.module);
      queryConstraints.push(where('module', '==', filterObject.module));
    }

    const q = query(productsColRef, ...queryConstraints);
    const snapshot = await getDocs(q);
    
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("[productService.filter] Found products:", results.length);
    return results;
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