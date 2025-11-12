import express from "express";
import axios from "axios";
import db from "./db.js";
import { connectToBroker, publishMessage } from "./broker.js";

const app = express();
app.use(express.json());

// RabbitMQ
connectToBroker().catch((err) => console.error("Broker init error", err));

// Create order
app.post("/", async (req, res) => {
  // TODO: Implement order creation with the following steps:
  // 1. Validate request body:
  //    - Check productId exists
  //    - Check quantity is positive
  // 2. Call product service to verify product exists:
  //    - Use axios to GET product details
  //    - Handle timeouts and errors
  // 3. Insert order into database:
  //    - Add to orders table with PENDING status
  // 4. Publish order.created event to message broker:
  //    - Include order id, product details, quantity
  // 5. Return success response with order details
  try {
    const { productId, quantity } = req.body;
    if (!productId || quantity <= 0)
      return res.status(400).json({ error: "Invalid request body" });
    const r = await axios.get(
      `${process.env.PRODUCT_SERVICE_URL}/${productId}`
    );
    const product = r.data;
    if (!product) return res.status(404).json({ error: "Product not found" });
    const order = await db.query(
      "INSERT INTO orders (product_id, quantity, status) VALUES ($1, $2, $3) RETURNING *",
      [productId, quantity, "PENDING"]
    );
    await publishMessage("order.created", {
      id: order.rows[0].id,
      product,
      quantity: order.rows[0].quantity,
    });
    res.status(201).json(order.rows[0]);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List orders
app.get("/", async (_req, res) => {
  const r = await db.query("SELECT * FROM orders ORDER BY id DESC");
  res.json(r.rows);
});

// Get order by id
app.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.query("SELECT * FROM orders WHERE id = $1", [id]);
  if (r.rows.length === 0)
    return res.status(404).json({ error: "Order not found" });
  res.json(r.rows[0]);
});

const PORT = 8003;
app.listen(PORT, () => console.log(`Order Service running on ${PORT}`));
