import { useState, useEffect } from "react";
import { Plus, ShoppingCart, Package, AlertCircle, Loader2, RefreshCw, Pencil, Trash2, User, Phone, ShoppingBag } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import CustomSelect from "@/components/ui/CustomSelect";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { productApi, memberApi } from "@/lib/endpoints";
import { useGymBranch } from "@/hooks/useGymBranch";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { showApiErrorToast } from "@/lib/api";

const categoryOptions = [
  { value: "supplement", label: "Supplement" },
  { value: "merchandise", label: "Merchandise" },
  { value: "gear", label: "Gear & Accessories" },
  { value: "service_package", label: "Service Package" },
];

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI / QR Code" },
  { value: "card", label: "Credit / Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-(--color-danger-soft) text-(--color-danger) border border-(--color-danger)/30">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-danger) shrink-0" />
        Out of Stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-(--color-warn-soft) text-(--color-warn) border border-(--color-warn)/30">
        <span className="w-1.5 h-1.5 rounded-full bg-(--color-warn) animate-pulse shrink-0" />
        Low Stock · <span className="font-mono font-bold text-(--color-text)">{stock} left</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-(--color-good-soft) text-(--color-good) border border-(--color-good)/30">
      <span className="w-1.5 h-1.5 rounded-full bg-(--color-good) shrink-0" />
      In Stock · <span className="font-mono font-bold text-(--color-text)">{stock}</span>
    </span>
  );
}

export default function Inventory() {
  const currentUserRole = useAuthStore((s) => s.user?.role);
  const isOwnerOrAdmin = currentUserRole === "GYM_OWNER" || currentUserRole === "SUPER_ADMIN" || currentUserRole === "BRANCH_MANAGER" || currentUserRole === "KIOSK";
  const { gymId, branchId, loading: resolvingBranch } = useGymBranch();
  const [products, setProducts] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [submittingSale, setSubmittingSale] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "supplement",
    price: 1999,
    stockQuantity: 20,
  });

  const [editProduct, setEditProduct] = useState({
    id: "",
    name: "",
    category: "supplement",
    price: 1999,
    stockQuantity: 20,
  });

  const [saleCustomerType, setSaleCustomerType] = useState<"member" | "walk_in">("walk_in");
  const [saleMemberId, setSaleMemberId] = useState("");
  const [walkInCustomerName, setWalkInCustomerName] = useState("");
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState("");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [salePaymentMethod, setSalePaymentMethod] = useState("cash");

  const openSaleModal = (p: any) => {
    setSelectedProduct(p);
    setSaleQuantity(1);
    setSaleCustomerType("walk_in");
    setSaleMemberId("");
    setWalkInCustomerName("");
    setWalkInCustomerPhone("");
    setSalePaymentMethod("cash");
    setShowSaleModal(true);
  };

  const fetchProducts = async () => {
    if (!gymId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [prodRes, memRes] = await Promise.all([
        productApi.list(gymId, branchId || undefined),
        memberApi.list(gymId, branchId || "").catch(() => []),
      ]);

      const list = Array.isArray(prodRes) ? prodRes : (prodRes as any)?.products || [];
      setProducts(list);

      let mList = Array.isArray(memRes) ? memRes : (memRes as any)?.members || [];
      if (mList.length === 0) {
        const fallbackRes = await memberApi.list(gymId, "").catch(() => null);
        mList = Array.isArray(fallbackRes) ? fallbackRes : (fallbackRes as any)?.members || [];
      }
      setMembersList(mList);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Failed to load inventory products";
      setError(msg);
      showApiErrorToast(err, "Failed to load inventory products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [gymId, branchId]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeGymId = gymId || "";
    setSubmittingAdd(true);
    try {
      await productApi.add(activeGymId, {
        ...newProduct,
        branchId: branchId || undefined,
        price: Number(newProduct.price),
        stockQuantity: Number(newProduct.stockQuantity),
      });
      toast.success(`Product ${newProduct.name} added to store!`);
      setShowAddModal(false);
      setNewProduct({ name: "", category: "supplement", price: 1999, stockQuantity: 20 });
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to add product.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleEditProduct = (p: any) => {
    setEditProduct({
      id: p._id || p.id,
      name: p.name || "",
      category: p.category || "supplement",
      price: p.price || 0,
      stockQuantity: p.stockQuantity || 0,
    });
    setShowEditModal(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEdit(true);
    try {
      await productApi.update(editProduct.id, {
        name: editProduct.name,
        category: editProduct.category,
        price: Number(editProduct.price),
        stockQuantity: Number(editProduct.stockQuantity),
      });
      toast.success(`Product ${editProduct.name} updated successfully!`);
      setShowEditModal(false);
      fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to update product.");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Delete Product Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeletingProduct(true);
    try {
      await productApi.delete(deleteTarget.id);
      toast.success(`Product "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product.");
    } finally {
      setDeletingProduct(false);
    }
  };

  const handleDeleteProduct = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const handleSellProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const prodId = selectedProduct._id || selectedProduct.id;
    const isDirectBuyer = saleCustomerType === "walk_in";
    const targetMember = isDirectBuyer ? undefined : (saleMemberId || undefined);

    if (!isDirectBuyer && !targetMember) {
      toast.error("Please select a registered gym member");
      return;
    }

    let formattedCustomerName: string | undefined;
    if (isDirectBuyer) {
      const trimmedName = walkInCustomerName.trim();
      const trimmedPhone = walkInCustomerPhone.trim();

      if (trimmedName && trimmedPhone) {
        formattedCustomerName = `${trimmedName} (${trimmedPhone})`;
      } else if (trimmedName) {
        formattedCustomerName = `${trimmedName} (Direct)`;
      } else if (trimmedPhone) {
        formattedCustomerName = `Customer (${trimmedPhone})`;
      } else {
        formattedCustomerName = "Direct Customer";
      }
    }

    setSubmittingSale(true);
    try {
      await productApi.checkout(prodId, {
        quantity: Number(saleQuantity),
        memberId: targetMember,
        customerName: formattedCustomerName,
        customerPhone: isDirectBuyer ? walkInCustomerPhone.trim() || undefined : undefined,
        paymentMethod: salePaymentMethod,
        notes: `Purchased ${saleQuantity}x ${selectedProduct.name}${isDirectBuyer && walkInCustomerPhone.trim() ? ` • Phone: ${walkInCustomerPhone.trim()}` : ""}`,
      } as any);
      toast.success(`Sold ${saleQuantity}x ${selectedProduct.name}! Payment recorded.`);
      setShowSaleModal(false);
      setSelectedProduct(null);
      setWalkInCustomerName("");
      setWalkInCustomerPhone("");
      fetchProducts();
      window.dispatchEvent(new CustomEvent("gymai-payments-updated"));
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to process store sale.");
    } finally {
      setSubmittingSale(false);
    }
  };

  const totalStock = products.reduce((acc, item) => acc + (item.stockQuantity || 0), 0);
  const totalValue = products.reduce((acc, item) => acc + (item.price || 0) * (item.stockQuantity || 0), 0);
  const lowStockCount = products.filter((item) => (item.stockQuantity || 0) <= 5).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Store & Product Inventory"
        subtitle="Supplements, Gear, & Merchandise Sales"
        backTo="/owner"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProducts}
              className="inline-flex items-center gap-1 text-xs text-(--color-text-muted) hover:text-(--color-text) p-2 rounded-lg bg-(--color-surface-2)"
              title="Refresh Products"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-(--color-accent)" : ""} />
            </button>
            {isOwnerOrAdmin && (
              <button
                onClick={() => setShowAddModal(true)}
                className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 py-2 hover:opacity-90"
              >
                <Plus size={15} /> Add product
              </button>
            )}
          </div>
        }
      />

      {/* Mobile & Tablet Add Product Button (Full space under header) */}
      {isOwnerOrAdmin && (
        <div className="block lg:hidden w-full">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-xl bg-(--color-accent) text-(--color-navbar) text-sm font-bold px-4 hover:opacity-90 active:scale-[0.99] shadow-sm transition-all"
          >
            <Plus size={17} /> Add product
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isOwnerOrAdmin ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3`}>
        <Card className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-400">
            <Package size={20} />
          </div>
          <div>
            <p className="text-xs text-(--color-text-muted)">Total Items in Stock</p>
            <p className="font-display text-lg font-semibold text-(--color-text)">{totalStock} units</p>
          </div>
        </Card>

        {isOwnerOrAdmin && (
          <Card className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
              <ShoppingCart size={20} />
            </div>
            <div>
              <p className="text-xs text-(--color-text-muted)">Inventory Value</p>
              <p className="font-display text-lg font-semibold text-(--color-text)">₹{totalValue.toLocaleString("en-IN")}</p>
            </div>
          </Card>
        )}

        <Card className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-rose-500/10 text-rose-400">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs text-(--color-text-muted)">Low Stock Warnings</p>
            <p className="font-display text-lg font-semibold text-rose-400">{lowStockCount} items</p>
          </div>
        </Card>
      </div>

      {error && (
        <Card className="text-center py-8 text-(--color-text-muted) space-y-3 border-rose-500/30">
          <p className="text-sm font-semibold text-rose-400">{error}</p>
          <button
            onClick={fetchProducts}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-(--color-surface-2) text-(--color-text) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
          >
            <RefreshCw size={14} /> Retry loading inventory
          </button>
        </Card>
      )}

      {resolvingBranch || loading ? (
        <Card className="flex items-center justify-center p-12 text-sm text-(--color-text-muted) gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-(--color-accent)" /> Loading store products...
        </Card>
      ) : products.length === 0 ? (
        <Card className="text-center py-12 text-(--color-text-muted) space-y-2">
          <Package className="w-8 h-8 mx-auto text-(--color-text-faint)" />
          <p className="text-sm font-medium text-(--color-text)">No products in store inventory</p>
          <p className="text-xs text-(--color-text-muted)">Click "Add product" to list supplements and merchandise.</p>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {products.map((p) => {
              const stock = p.stockQuantity || 0;
              return (
                <div key={p._id || p.id} className="p-3.5 rounded-xl border border-(--color-border) bg-(--color-surface-2)/40 flex flex-col justify-between gap-2.5">
                  {/* Desktop Layout (100% Untouched) */}
                  <div className="hidden lg:flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-display text-sm font-semibold text-(--color-text)">{p.name}</h4>
                      <p className="text-xs text-(--color-text-muted) capitalize mt-0.5">
                        {p.category} · <span className="font-mono text-(--color-text) font-semibold">₹{(p.price || 0).toLocaleString("en-IN")}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <StockBadge stock={stock} />
                      <button
                        onClick={() => openSaleModal(p)}
                        className="px-3 py-1.5 rounded-full bg-(--color-accent) text-(--color-navbar) text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        Sell (POS)
                      </button>
                      {isOwnerOrAdmin && (
                        <>
                          <button
                            onClick={() => handleEditProduct(p)}
                            className="p-2 rounded-lg hover:bg-white/10 text-amber-400 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p._id || p.id, p.name)}
                            className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Mobile & Tablet Layout (Modern, clean, touch-friendly POS card) */}
                  <div className="lg:hidden space-y-3">
                    {/* Top Row: Name + Price */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display font-semibold text-sm text-(--color-text) break-words">{p.name}</h4>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-(--color-surface-3) text-(--color-text-muted) border border-(--color-border) capitalize">
                            {p.category}
                          </span>
                          <StockBadge stock={stock} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-base font-bold text-(--color-text)">
                          ₹{(p.price || 0).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Row: POS Sale Button (full focus) + Edit & Delete Action Icons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-(--color-border-soft)">
                      <button
                        onClick={() => openSaleModal(p)}
                        className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all shadow-xs"
                      >
                        <ShoppingCart size={14} /> Sell (POS)
                      </button>

                      {isOwnerOrAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleEditProduct(p)}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-(--color-surface-2) border border-(--color-border) text-amber-400 hover:bg-amber-500/10 active:scale-95 transition-all"
                            title="Edit Product"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p._id || p.id, p.name)}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-(--color-surface-2) border border-(--color-border) text-rose-400 hover:bg-rose-500/10 active:scale-95 transition-all"
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} maxWidth="md" title="Add Store Product">
          <form onSubmit={handleAddProduct} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whey Protein Isolate (2kg)"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <CustomSelect
                  label="Category"
                  value={newProduct.category}
                  onChange={(val) => setNewProduct({ ...newProduct, category: val })}
                  options={categoryOptions}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                  />
                </div>
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={newProduct.stockQuantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stockQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) text-xs font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingAdd}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingAdd ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* POS Sale Modal */}
      {showSaleModal && selectedProduct && (
        <Modal
          onClose={() => {
            setShowSaleModal(false);
            setSelectedProduct(null);
          }}
          maxWidth="md"
          title={`Record Sale: ${selectedProduct.name}`}
        >
          <form onSubmit={handleSellProduct} className="space-y-4">
            <div className="space-y-3.5 text-xs">
              {/* Customer Type Segmented Switcher (Mobile & Desktop Responsive) */}
              <div>
                <label className="block text-(--color-text-muted) mb-1.5 font-medium">Customer Type</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-(--color-surface-2) border border-(--color-border)">
                  <button
                    type="button"
                    onClick={() => setSaleCustomerType("walk_in")}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      saleCustomerType === "walk_in"
                        ? "bg-(--color-surface) text-(--color-accent) shadow-xs border border-(--color-border)"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    <ShoppingBag size={16} className="shrink-0" />
                    <span className="text-center leading-tight">Direct / Walk-in Buyer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleCustomerType("member")}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      saleCustomerType === "member"
                        ? "bg-(--color-surface) text-(--color-accent) shadow-xs border border-(--color-border)"
                        : "text-(--color-text-muted) hover:text-(--color-text)"
                    }`}
                  >
                    <User size={16} className="shrink-0" />
                    <span className="text-center leading-tight">Registered Member</span>
                  </button>
                </div>
              </div>

              {/* Customer Fields: Registered Member vs Walk-in Customer */}
              {saleCustomerType === "member" ? (
                <div>
                  <CustomSelect
                    label="Select Registered Member"
                    value={saleMemberId}
                    onChange={(val) => setSaleMemberId(val)}
                    options={[
                      { value: "", label: "-- Choose Member --" },
                      ...membersList.map((m) => {
                        const mId = m._id || m.id;
                        const name = m.fullName || m.name || m.userId?.fullName || "Member";
                        const phone = m.phone || m.userId?.phone || "";
                        return { label: `${name} ${phone ? `(${phone})` : ""}`, value: String(mId) };
                      }),
                    ]}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-(--color-text-muted) mb-1 font-medium">Customer Name</label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                        <input
                          type="text"
                          placeholder="e.g. Rahul Sharma"
                          value={walkInCustomerName}
                          onChange={(e) => setWalkInCustomerName(e.target.value)}
                          className="w-full rounded-xl bg-(--color-surface-2) pl-9 pr-3 py-2.5 h-11 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent) transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-(--color-text-muted) mb-1 font-medium">Phone Number (Optional)</label>
                      <div className="relative">
                        <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--color-text-muted)" />
                        <input
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={walkInCustomerPhone}
                          onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                          className="w-full rounded-xl bg-(--color-surface-2) pl-9 pr-3 py-2.5 h-11 text-sm font-mono text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent) transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-(--color-text-muted) px-1">
                    Invoice and ledger payment will be recorded under:{" "}
                    <span className="font-semibold text-(--color-accent)">
                      "{walkInCustomerName.trim() ? walkInCustomerName.trim() : "Direct Customer"}"
                      {walkInCustomerPhone.trim() ? ` (${walkInCustomerPhone.trim()})` : ""}
                    </span>
                  </p>
                </div>
              )}

              {/* Quantity and Payment Method (Responsive 1-col on mobile, 2-col on desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-(--color-text-muted) font-medium">Quantity to Sell</label>
                    <span className="text-[11px] font-medium text-(--color-good)">
                      In Stock: {selectedProduct.stockQuantity || 0}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stockQuantity || 99}
                    value={saleQuantity}
                    onChange={(e) => setSaleQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl bg-(--color-surface-2) px-3 py-2.5 h-11 text-sm font-mono text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>

                <div>
                  <CustomSelect
                    label="Payment Method"
                    value={salePaymentMethod}
                    onChange={(val) => setSalePaymentMethod(val)}
                    options={paymentMethodOptions}
                  />
                </div>
              </div>

              {/* Order Calculation Summary Card */}
              <div className="p-3.5 rounded-xl bg-(--color-surface-2) border border-(--color-border) text-xs space-y-2">
                <div className="flex justify-between items-center text-(--color-text-muted)">
                  <span>Unit Price:</span>
                  <span className="font-mono font-medium text-(--color-text)">₹{(selectedProduct.price || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center text-(--color-text-muted)">
                  <span>Quantity:</span>
                  <span className="font-mono font-medium text-(--color-text)">{saleQuantity} unit(s)</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-(--color-text) pt-2 border-t border-(--color-border)">
                  <span>Total Payable:</span>
                  <span className="font-mono text-base text-(--color-good)">
                    ₹{((selectedProduct.price || 0) * saleQuantity).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Touch-friendly on mobile/tablet, balanced on desktop */}
            <div className="flex items-center gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowSaleModal(false);
                  setSelectedProduct(null);
                }}
                className="flex-1 h-11 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text) border border-(--color-border) hover:bg-(--color-surface-3) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingSale}
                className="flex-1 h-11 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                {submittingSale ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete & Record Sale"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <Modal onClose={() => setShowEditModal(false)} maxWidth="md" title="Edit Store Product">
          <form onSubmit={handleUpdateProduct} className="space-y-4">
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Product Name</label>
                <input
                  type="text"
                  required
                  value={editProduct.name}
                  onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                  className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border) focus:outline-none focus:border-(--color-accent)"
                />
              </div>

              <div>
                <label className="block text-(--color-text-muted) mb-1 font-medium">Category</label>
                <CustomSelect
                  value={editProduct.category}
                  onChange={(val) => setEditProduct({ ...editProduct, category: val })}
                  options={categoryOptions}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editProduct.price}
                    onChange={(e) => setEditProduct({ ...editProduct, price: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                  />
                </div>

                <div>
                  <label className="block text-(--color-text-muted) mb-1 font-medium">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editProduct.stockQuantity}
                    onChange={(e) => setEditProduct({ ...editProduct, stockQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl bg-(--color-surface-2) p-2.5 text-sm text-(--color-text) border border-(--color-border)"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-(--color-surface-2) font-semibold text-(--color-text)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="flex-1 py-2.5 rounded-xl bg-(--color-accent) text-(--color-navbar) font-bold shadow-md flex items-center justify-center gap-1.5"
              >
                {submittingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteProduct}
        title="Delete Inventory Item"
        description={`Are you sure you want to permanently delete "${deleteTarget?.name}"?`}
        confirmText="Delete Item"
        tone="danger"
        loading={deletingProduct}
      />
    </div>
  );
}
