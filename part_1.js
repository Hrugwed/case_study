router.post("/products", async (req, res) => {

    // honestly learned startTransaction and abortTransaction concept while solving the question for the case study
    // start a mongoose session for a transaction
    // this way both product and inventory are saved together
    // if one fails, nothing is saved — avoids half-created data like old code
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { name, sku, price, warehouseId, initialQuantity } = req.body;

        // we need to make sure all the important fields are present
        // name, sku, price, warehouseId are required
        // missing any of these would break the product creation or inventory mapping
        if (!name || !sku || !price || !warehouseId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // hoping that in the product schema sku is unique and required
        // we also check it here to prevent any fatal errors
        // duplicate SKUs would mess up inventory, reports, and future operations
        const existingProduct = await Product.findOne({ sku }).session(session);
        if (existingProduct) {
            return res.status(400).json({ error: "SKU already exists" });
        }

        // creating the product object but not saving yet
        // parseFloat(price) ensures decimal prices are stored correctly
        // avoids problems in totals and calculations later
        // removed the warehouseId from the product as there can be many warehouses and the correct business logic is to keep it in inventory
        const product = new Product({
            name,
            sku,
            price: parseFloat(price),
        });

        // creating the inventory object for the warehouse
        // initialQuantity is optional so we default to 0 if not provided
        // this prevents errors if someone forgets to add stock at creation
        const inventory = new Inventory({
            productId: product._id, // mongoose generates _id even before saving
            warehouseId,
            quantity: initialQuantity ?? 0,
        });


        // save both product and inventory as part of the same transaction
        // old code saved separately with no transaction, which could leave half-created data in database
        await product.save({ session });
        await inventory.save({ session });

        // commit the transaction, now both are permanently saved
        await session.commitTransaction();
        session.endSession();

        // everything worked, returning success with the new product id
        return res.status(201).json({
            message: "Product created",
            productId: product._id,
        });

    } catch (err) {


        // if any error happens, rollback everything
        // old code had no error handling, so API could crash and leave bad data and user experience.
        await session.abortTransaction();
        session.endSession();

        console.error("Error creating product:", err);
        return res.status(500).json({ error: "Server error" });
    }
});
