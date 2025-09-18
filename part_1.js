router.post("/products", async (req, res) => {
  try {
    const { name, sku, price, warehouseId, initialQuantity } = req.body;

    // Validate input
    if (!name || !sku || !price || !warehouseId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if SKU exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({ error: "SKU already exists" });
    }

    // Prepare product but don't save yet
    const product = new Product({
      name,
      sku,
      price: parseFloat(price),
    });

    // Prepare inventory but don't save yet
    const inventory = new Inventory({
      productId: product._id, // Mongoose will generate an _id already
      warehouseId,
      quantity: initialQuantity ?? 0,
    });

    // Save both
    await product.save();
    await inventory.save();

    return res.status(201).json({
      message: "Product created",
      productId: product._id,
    });

  } catch (err) {
    console.error("Error creating product:", err);
    return res.status(500).json({ error: "Server error" });
  }
});
