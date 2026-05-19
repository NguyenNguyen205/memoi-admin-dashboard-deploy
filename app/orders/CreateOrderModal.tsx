"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Input, Select, SelectItem, Card, CardBody, Chip, Divider,
  useDisclosure
} from "@nextui-org/react";
import { Plus, ShoppingCart, Mail, Phone, MapPin, Package, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createOrder, type LineItemInput } from "@/actions/createOrder";
import { formatSGD, isValidEmail } from "@/lib/utils";

// Line item structure (client-side)
interface LineItem {
  tempId: string;
  productId: number;
  productName: string;
  productSku: string;
  variantId: number;
  size: string;
  colorName: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
}

// Product and variant types from database
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
  product_variants: ProductVariant[];
}

export function CreateOrderModal() {
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const queryClient = useQueryClient();

  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState({
    line1: "",
    city: "",
    state: "SG",
    postalCode: "",
    country: "SG"
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState("1");

  // Result state
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch active products with variants
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["products-for-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, name, sku,
          product_variants(id, size, stock, price)
        `)
        .eq("status", "Active")
        .order("name");

      if (error) throw error;
      return data as Product[];
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  // Get selected product details
  const currentProduct = useMemo(() => {
    if (!selectedProduct) return null;
    return products.find(p => p.id.toString() === selectedProduct) || null;
  }, [selectedProduct, products]);

  // Get available variants for selected product (only those with stock)
  const availableVariants = useMemo(() => {
    if (!currentProduct) return [];
    return currentProduct.product_variants.filter(v => v.stock > 0);
  }, [currentProduct]);

  // Get selected variant details
  const currentVariant = useMemo(() => {
    if (!selectedVariant || !availableVariants) return null;
    return availableVariants.find(v => v.id.toString() === selectedVariant) || null;
  }, [selectedVariant, availableVariants]);

  // Calculate order total
  const orderTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }, [lineItems]);

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      isValidEmail(email) &&
      phone.trim().length > 0 &&
      address.line1.trim().length > 0 &&
      address.city.trim().length > 0 &&
      address.state.trim().length > 0 &&
      address.postalCode.trim().length > 0 &&
      lineItems.length > 0
    );
  }, [email, phone, address, lineItems]);

  // Extract color from product name or SKU
  const extractColor = (productName: string, sku: string): string => {
    // Try to extract color from SKU (e.g., "ALB-TOP-WHT-01" -> "White")
    const skuParts = sku.split('-');
    const colorCode = skuParts.length >= 3 ? skuParts[2] : '';

    // Map common color codes
    const colorMap: Record<string, string> = {
      'WHT': 'White',
      'BLK': 'Black',
      'RED': 'Red',
      'BLU': 'Blue',
      'GRN': 'Green',
      'YEL': 'Yellow',
      'BRN': 'Brown',
      'BURG': 'Burgundy',
    };

    if (colorMap[colorCode]) {
      return colorMap[colorCode];
    }

    // Fallback: try to find color words in product name
    const colorWords = ['White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Burgundy', 'Pink', 'Purple'];
    for (const color of colorWords) {
      if (productName.toLowerCase().includes(color.toLowerCase())) {
        return color;
      }
    }

    return ''; // No color found
  };

  // Add product to order
  const handleAddProduct = () => {
    if (!currentProduct || !currentVariant) return;

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    if (qty > currentVariant.stock) return;

    const newItem: LineItem = {
      tempId: `${Date.now()}-${Math.random()}`,
      productId: currentProduct.id,
      productName: currentProduct.name,
      productSku: currentProduct.sku,
      variantId: currentVariant.id,
      size: currentVariant.size,
      colorName: extractColor(currentProduct.name, currentProduct.sku),
      quantity: qty,
      unitPrice: currentVariant.price,
      availableStock: currentVariant.stock,
    };

    setLineItems([...lineItems, newItem]);

    // Reset selection
    setSelectedProduct("");
    setSelectedVariant("");
    setQuantity("1");
  };

  // Remove line item
  const handleRemoveItem = (tempId: string) => {
    setLineItems(lineItems.filter(item => item.tempId !== tempId));
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const lineItemsInput: LineItemInput[] = lineItems.map(item => ({
        productVariantId: item.variantId,
        productName: item.productName,
        productSku: item.productSku,
        size: item.size,
        colorName: item.colorName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));

      return await createOrder({
        email,
        phoneNumber: phone,
        customerName: customerName || undefined,
        shippingAddress: {
          line1: address.line1,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
        lineItems: lineItemsInput,
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        setResult({
          success: true,
          message: `Order ${data.order?.order_number} created successfully!`,
        });

        // Refresh data
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["inventory"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });

        // Reset form
        setTimeout(() => {
          setEmail("");
          setPhone("");
          setCustomerName("");
          setAddress({ line1: "", city: "", state: "SG", postalCode: "", country: "SG" });
          setLineItems([]);
          setResult(null);
          onClose();
        }, 2000);
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to create order",
        });
      }
    },
    onError: (error: any) => {
      setResult({
        success: false,
        message: error.message || "An unexpected error occurred",
      });
    },
  });

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  return (
    <>
      <Button
        color="primary"
        startContent={<Plus size={18} />}
        onClick={onOpen}
        className="shadow-md shadow-primary/30 font-semibold"
      >
        Create Order
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        backdrop="blur"
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onCloseModal) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Create New Order
                <span className="text-sm font-normal text-default-500">
                  Fill in order details for manual/phone orders
                </span>
              </ModalHeader>

              <ModalBody className="pb-6">
                {!result ? (
                  <div className="flex flex-col gap-6">
                    {/* Customer Info Section */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Mail size={16} className="text-primary" />
                        Customer Information
                      </h3>
                      <div className="flex flex-col gap-3">
                        <Input
                          type="email"
                          label="Email"
                          placeholder="customer@example.com"
                          value={email}
                          onValueChange={setEmail}
                          variant="bordered"
                          isRequired
                          isInvalid={email.length > 0 && !isValidEmail(email)}
                          errorMessage={email.length > 0 && !isValidEmail(email) ? "Invalid email format" : ""}
                          isDisabled={createOrderMutation.isPending}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="tel"
                            label="Phone Number"
                            placeholder="12345678"
                            value={phone}
                            onValueChange={setPhone}
                            variant="bordered"
                            isRequired
                            isDisabled={createOrderMutation.isPending}
                          />
                          <Input
                            type="text"
                            label="Customer Name (Optional)"
                            placeholder="John Doe"
                            value={customerName}
                            onValueChange={setCustomerName}
                            variant="bordered"
                            isDisabled={createOrderMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    <Divider />

                    {/* Shipping Address Section */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        Shipping Address
                      </h3>
                      <div className="flex flex-col gap-3">
                        <Input
                          label="Address Line 1"
                          placeholder="123 Main Street"
                          value={address.line1}
                          onValueChange={(val) => setAddress({ ...address, line1: val })}
                          variant="bordered"
                          isRequired
                          isDisabled={createOrderMutation.isPending}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="City"
                            placeholder="Singapore"
                            value={address.city}
                            onValueChange={(val) => setAddress({ ...address, city: val })}
                            variant="bordered"
                            isRequired
                            isDisabled={createOrderMutation.isPending}
                          />
                          <Input
                            label="State/Region"
                            placeholder="SG"
                            value={address.state}
                            onValueChange={(val) => setAddress({ ...address, state: val })}
                            variant="bordered"
                            isRequired
                            isDisabled={createOrderMutation.isPending}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Postal Code"
                            placeholder="123456"
                            value={address.postalCode}
                            onValueChange={(val) => setAddress({ ...address, postalCode: val })}
                            variant="bordered"
                            isRequired
                            isDisabled={createOrderMutation.isPending}
                          />
                          <Input
                            label="Country"
                            value={address.country}
                            onValueChange={(val) => setAddress({ ...address, country: val })}
                            variant="bordered"
                            isRequired
                            isDisabled={createOrderMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>

                    <Divider />

                    {/* Order Items Section */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Package size={16} className="text-primary" />
                        Order Items
                      </h3>

                      {/* Add Product Form */}
                      <Card className="mb-4 bg-default-50">
                        <CardBody className="gap-3">
                          <div className="grid grid-cols-3 gap-3">
                            <Select
                              label="Select Product"
                              placeholder="Choose product"
                              selectedKeys={selectedProduct ? [selectedProduct] : []}
                              onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                setSelectedProduct(key || "");
                                setSelectedVariant("");
                              }}
                              variant="bordered"
                              isLoading={isLoadingProducts}
                              isDisabled={createOrderMutation.isPending}
                            >
                              {products.map((product) => (
                                <SelectItem key={product.id.toString()} value={product.id.toString()}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </Select>

                            <Select
                              label="Select Variant"
                              placeholder="Choose size"
                              selectedKeys={selectedVariant ? [selectedVariant] : []}
                              onSelectionChange={(keys) => {
                                const key = Array.from(keys)[0] as string;
                                setSelectedVariant(key || "");
                              }}
                              variant="bordered"
                              isDisabled={!currentProduct || createOrderMutation.isPending}
                            >
                              {availableVariants.map((variant) => (
                                <SelectItem
                                  key={variant.id.toString()}
                                  value={variant.id.toString()}
                                  textValue={`${variant.size} - ${formatSGD(variant.price)}`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span>{variant.size}</span>
                                    <span className="text-xs text-default-500">
                                      {formatSGD(variant.price)} • Stock: {variant.stock}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </Select>

                            <Input
                              type="number"
                              label="Quantity"
                              placeholder="1"
                              value={quantity}
                              onValueChange={setQuantity}
                              variant="bordered"
                              min={1}
                              max={currentVariant?.stock || 999}
                              isDisabled={!currentVariant || createOrderMutation.isPending}
                            />
                          </div>

                          {currentVariant && (
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-default-500">Unit Price:</span>
                                <span className="font-semibold">{formatSGD(currentVariant.price)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-default-500">Available:</span>
                                <Chip
                                  size="sm"
                                  color={currentVariant.stock < 5 ? "warning" : "success"}
                                  variant="flat"
                                >
                                  {currentVariant.stock} in stock
                                </Chip>
                              </div>
                            </div>
                          )}

                          <Button
                            color="primary"
                            variant="flat"
                            startContent={<Plus size={16} />}
                            onClick={handleAddProduct}
                            isDisabled={
                              !currentVariant ||
                              parseInt(quantity) < 1 ||
                              parseInt(quantity) > (currentVariant?.stock || 0) ||
                              createOrderMutation.isPending
                            }
                            size="sm"
                            className="w-full"
                          >
                            Add to Order
                          </Button>
                        </CardBody>
                      </Card>

                      {/* Line Items List */}
                      {lineItems.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {lineItems.map((item) => (
                            <Card key={item.tempId} className="border border-divider">
                              <CardBody className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{item.productName}</p>
                                    <p className="text-xs text-default-500">
                                      Size: {item.size} • {formatSGD(item.unitPrice)} × {item.quantity}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-semibold text-sm">
                                      {formatSGD(item.unitPrice * item.quantity)}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      isIconOnly
                                      onClick={() => handleRemoveItem(item.tempId)}
                                      isDisabled={createOrderMutation.isPending}
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card className="bg-default-100">
                          <CardBody className="text-center py-8 text-default-500">
                            <Package size={32} className="mx-auto mb-2 text-default-300" />
                            <p className="text-sm">No products added yet</p>
                          </CardBody>
                        </Card>
                      )}
                    </div>

                    {/* Order Summary */}
                    {lineItems.length > 0 && (
                      <>
                        <Divider />
                        <Card className="bg-primary/10 border border-primary/20">
                          <CardBody className="flex flex-row items-center justify-between p-4">
                            <div>
                              <p className="text-sm text-default-600">Order Total</p>
                              <p className="text-xs text-default-500">{lineItems.length} item(s)</p>
                            </div>
                            <p className="text-2xl font-bold text-primary">
                              {formatSGD(orderTotal)}
                            </p>
                          </CardBody>
                        </Card>
                      </>
                    )}
                  </div>
                ) : (
                  <Card className={`${result.success ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'} border`}>
                    <CardBody className="flex flex-row items-start gap-3 p-6">
                      {result.success ? (
                        <CheckCircle2 className="text-success shrink-0 mt-0.5" size={24} />
                      ) : (
                        <AlertCircle className="text-danger shrink-0 mt-0.5" size={24} />
                      )}
                      <div>
                        <p className={`font-semibold mb-1 ${result.success ? 'text-success' : 'text-danger'}`}>
                          {result.success ? 'Success!' : 'Error'}
                        </p>
                        <p className="text-sm">{result.message}</p>
                      </div>
                    </CardBody>
                  </Card>
                )}
              </ModalBody>

              <ModalFooter>
                <Button
                  color="default"
                  variant="light"
                  onPress={handleClose}
                  isDisabled={createOrderMutation.isPending}
                >
                  {result?.success ? 'Close' : 'Cancel'}
                </Button>
                {!result?.success && (
                  <Button
                    color="primary"
                    onPress={() => createOrderMutation.mutate()}
                    isLoading={createOrderMutation.isPending}
                    isDisabled={!isFormValid}
                    className="shadow-md shadow-primary/30"
                    startContent={!createOrderMutation.isPending ? <ShoppingCart size={18} /> : null}
                  >
                    Create Order
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
