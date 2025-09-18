// GET /api/companies/:companyId/alerts/low-stock
router.get("/companies/:companyId/alerts/low-stock", async (req, res) => {
  try {
    const { companyId } = req.params;

    // 1. Fetch all warehouses for this company
    const warehouses = await Warehouse.find({ companyId });

    if (!warehouses || warehouses.length === 0) {
      return res.status(404).json({ error: "No warehouses found for this company" });
    }

    let alerts = [];

    // 2. For each warehouse, check inventory
    for (const wh of warehouses) {
      const inventories = await Inventory.find({ warehouseId: wh._id })
        .populate("productId") // so we can get product info
        .lean();

      for (const inv of inventories) {
        const product = inv.productId;

        // Assumption: product schema has threshold + lastSaleDate
        const threshold = product.lowStockThreshold || 10; // default threshold
        const recentSale = product.lastSaleDate && 
                           (Date.now() - new Date(product.lastSaleDate)) < (30 * 24 * 60 * 60 * 1000); // last 30 days

        if (inv.quantity < threshold && recentSale) {
          // Assumption: SupplierProducts links product -> supplier
          const supplierLink = await SupplierProducts.findOne({ productId: product._id })
            .populate("supplierId")
            .lean();

          // Fake calculation: how many days until stockout
          // Assuming daily average sales stored in product.dailySalesAvg
          const daysUntilStockout = product.dailySalesAvg > 0 
            ? Math.floor(inv.quantity / product.dailySalesAvg) 
            : null;

          alerts.push({
            product_id: product._id,
            product_name: product.name,
            sku: product.sku,
            warehouse_id: wh._id,
            warehouse_name: wh.name,
            current_stock: inv.quantity,
            threshold: threshold,
            days_until_stockout: daysUntilStockout,
            supplier: supplierLink
              ? {
                  id: supplierLink.supplierId._id,
                  name: supplierLink.supplierId.name,
                  contact_email: supplierLink.supplierId.contactEmail
                }
              : null
          });
        }
      }
    }

    return res.json({
      alerts,
      total_alerts: alerts.length
    });

  } catch (err) {
    console.error("Error fetching low-stock alerts:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// explaining why i did what i did


// Step 1: Find warehouses
// Since a company can have multiple warehouses, I first grab all wrehouses that belong to the given company ID.


// Example: Company A → Warehouse 1 (Pune), Warehouse 2 (Mumbai).
// Step 2: Loop through inventory
// For each warehouse, I check what products are insde (Inventory collection).


// Example: Pune warehouse has 5 Cakes, 3 Candles.
// Step 3: Compare stock with threshold
// I check if the quantity < threshold. Threshold can varyy product, so I assume we have lowStockThreshold in the product schema.


// Example: Cake threshold = 20, but only 5 left → alert.
// Step 4: Only alert if recent sales
// We don’t want false alarms on products that nobody buys anymore. So I check lastSaleDate inthe product, and only show alerts if it was sold in the last 30 days.


// Example: A cake sold last week → valid alert. Old dusty product with no sales → no alert.
// Step 5: Add supplier info
// I join product → supplier via SupplierProducts table


// Example: Cake comes from “Sweet Supplier Pvt Ltd.”
// Step 6: Calculate “days until stockout”
// I make a simple estimate using quantity / average daily sales



// Example: 5 cakes left, selling 0.4 cakes/day → about 12 days until stockout.
// Edge Cases I handled
// Company has no warehouses → return 404.
// Warehouse has no inventory → no alerts.
// Product has no supplier → still return alert, but supplier = null.
// Product has no daily sales data → days_until_stockout = null.
// If DB errors happen → catch and return 500.

