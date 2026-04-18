"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Table, TableHeader, TableColumn, TableBody, TableRow, TableCell,
    Pagination, Spinner, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody,
    useDisclosure, Tabs, Tab, Input
} from "@nextui-org/react";
import { Layers, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/PageHeader";

// --- GLOBAL UTILITY ---
// Move this to lib/utils.ts later so you can use it on the Orders page too!
export const formatSGD = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD',
    }).format(amount);
};

const ROWS_PER_PAGE = 10;

interface ProductVariant {
    id: number;
    size: string;
    stock: number;
    price: number;
}

interface Product {
    id: number;
    name: string;
    sku: string;
    status: string;
    product_variants: ProductVariant[];
}

// 1. Fetch function updated with the smart filter
const fetchInventory = async (page: number, filter: "All" | "Low Stock") => {
    const from = (page - 1) * ROWS_PER_PAGE;
    const to = from + ROWS_PER_PAGE - 1;

    const variantQuery = filter === "Low Stock" ? "product_variants!inner" : "product_variants";

    let query = supabase
        .from("products")
        .select(`id, name, sku, status, ${variantQuery}(id, size, stock, price)`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

    if (filter === "Low Stock") {
        query = query.lt("product_variants.stock", 5);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data as Product[], count: count ?? 0 };
};

// --- INLINE EDITING COMPONENT ---
// This handles the instant click-to-edit UX for the stock numbers
function InlineStockEditor({ variant, onUpdate }: { variant: ProductVariant, onUpdate: (id: number, stock: number) => Promise<void> }) {
    const [isEditing, setIsEditing] = useState(false);
    const [stockValue, setStockValue] = useState(variant.stock.toString());
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        const newStock = parseInt(stockValue, 10);

        // If they typed letters or didn't change the number, just close it.
        if (isNaN(newStock) || newStock === variant.stock) {
            setIsEditing(false);
            setStockValue(variant.stock.toString());
            return;
        }

        setIsLoading(true);
        await onUpdate(variant.id, newStock);
        setIsLoading(false);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <Input
                autoFocus
                size="sm"
                variant="faded"
                value={stockValue}
                onValueChange={setStockValue}
                isDisabled={isLoading}
                onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") {
                        setIsEditing(false);
                        setStockValue(variant.stock.toString());
                    }
                }}
                onBlur={handleSave} // Saves automatically if they click away
                classNames={{ inputWrapper: "h-8 min-h-8 w-24" }}
                endContent={isLoading ? <Spinner size="sm" /> : null}
            />
        );
    }

    return (
        <div
            className="cursor-pointer hover:bg-default-100 p-1 rounded-md inline-block px-2 transition-colors border border-transparent hover:border-default-200"
            onClick={() => setIsEditing(true)}
            title="Click to edit stock"
        >
            <Chip size="sm" color={variant.stock === 0 ? "danger" : (variant.stock < 5 ? "warning" : "success")} variant="dot" className="border-none cursor-pointer">
                {variant.stock} in stock
            </Chip>
        </div>
    );
}


export default function InventoryPage() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState<"All" | "Low Stock">("All");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    const { data, isLoading } = useQuery({
        queryKey: ["inventory", page, filter],
        queryFn: () => fetchInventory(page, filter),
    });

    const pages = data?.count ? Math.ceil(data.count / ROWS_PER_PAGE) : 0;

    const handleViewVariants = (product: Product) => {
        setSelectedProduct(product);
        onOpen();
    };

    // --- INSTANT STOCK UPDATE LOGIC ---
    const handleUpdateStock = async (variantId: number, newStock: number) => {
        // 1. Update the database
        const { error } = await supabase
            .from("product_variants")
            .update({ stock: newStock })
            .eq("id", variantId);

        if (error) {
            alert("Failed to update stock. Please try again.");
            return;
        }

        // 2. Instantly update the modal UI so the user doesn't see a flicker
        setSelectedProduct((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                product_variants: prev.product_variants.map(v =>
                    v.id === variantId ? { ...v, stock: newStock } : v
                )
            };
        });

        // 3. Silently refresh the main table in the background to update the Total Stock numbers
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
    };

    return (
        <div className="flex flex-col h-full">
            <PageHeader title="Inventory Tracking" queryKey={["inventory"]} />

            {/* Smart Filter Toggle */}
            <div className="mb-6">
                <Tabs
                    aria-label="Inventory Filters"
                    selectedKey={filter}
                    onSelectionChange={(key) => {
                        setFilter(key as "All" | "Low Stock");
                        setPage(1);
                    }}
                    color="danger"
                    variant="light"
                >
                    <Tab key="All" title="All Inventory" />
                    <Tab
                        key="Low Stock"
                        title={
                            <div className="flex items-center space-x-2">
                                <AlertTriangle size={16} />
                                <span>Low Stock Alerts</span>
                            </div>
                        }
                    />
                </Tabs>
            </div>

            <div className="flex-1 bg-content1 p-4 rounded-xl border border-divider">
                <Table
                    aria-label="Inventory table"
                    bottomContent={
                        pages > 0 ? (
                            <div className="flex w-full justify-center">
                                <Pagination isCompact showControls showShadow color="primary" page={page} total={pages} onChange={(page) => setPage(page)} />
                            </div>
                        ) : null
                    }
                >
                    <TableHeader>
                        <TableColumn>PRODUCT NAME</TableColumn>
                        <TableColumn>SKU</TableColumn>
                        <TableColumn>TOTAL STOCK</TableColumn>
                        <TableColumn>STATUS</TableColumn>
                        <TableColumn align="center">ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody
                        items={data?.data ?? []}
                        isLoading={isLoading}
                        loadingContent={<Spinner label="Loading inventory..." />}
                        emptyContent={!isLoading && (filter === "Low Stock" ? "Looking good! No low stock items." : "No products found.")}
                    >
                        {(product) => {
                            const totalStock = product.product_variants.reduce((acc, variant) => acc + (variant.stock || 0), 0);
                            const hasLowStockVariant = product.product_variants.some(v => v.stock < 5);

                            return (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">
                                        {product.name}
                                        {hasLowStockVariant && filter === "All" && (
                                            <Chip size="sm" color="danger" variant="dot" className="ml-2 border-none">Low</Chip>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-default-500">{product.sku}</TableCell>
                                    <TableCell>
                                        <span className={totalStock === 0 ? "text-danger font-bold" : (totalStock < 5 ? "text-warning font-semibold" : "")}>
                                            {totalStock}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="sm" variant="flat" color={product.status === "Active" ? "success" : "default"}>
                                            {product.status}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <Button size="sm" variant="light" color="primary" startContent={<Layers size={14} />} onClick={() => handleViewVariants(product)}>
                                            View Variants
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        }}
                    </TableBody>
                </Table>
            </div>

            <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                {selectedProduct?.name}
                                <span className="text-sm font-normal text-default-500">SKU: {selectedProduct?.sku}</span>
                            </ModalHeader>
                            <ModalBody className="pb-6">
                                {selectedProduct?.product_variants && selectedProduct.product_variants.length > 0 ? (
                                    <div className="border border-divider rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-default-100 text-default-600">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Size / Variant</th>
                                                    <th className="px-4 py-3 font-medium">Price</th>
                                                    <th className="px-4 py-3 font-medium">Stock Level</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-divider">
                                                {selectedProduct.product_variants.map((variant) => (
                                                    <tr key={variant.id} className={variant.stock < 5 ? "bg-danger/5" : ""}>
                                                        <td className="px-4 py-3 font-medium">{variant.size || "Default"}</td>
                                                        <td className="px-4 py-3 text-default-500">{formatSGD(variant.price || 0)}</td>
                                                        <td className="px-4 py-3">
                                                            {/* 🔥 MAGIC INLINE EDITOR 🔥 */}
                                                            <InlineStockEditor
                                                                variant={variant}
                                                                onUpdate={handleUpdateStock}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="p-3 bg-default-50 text-xs text-default-400 border-t border-divider text-center">
                                            💡 Click any stock pill to edit instantly. Hit Enter to save.
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 text-default-500 bg-default-100 rounded-lg">No variants found.</div>
                                )}
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}