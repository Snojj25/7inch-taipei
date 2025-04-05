const { executePlan } = require("./payment");

const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON request bodies
app.use(express.json());

// A simple welcome route
app.get("/", (req, res) => {
  res.send("Welcome to my API server!");
});

app.post("/api/execute_plan", async (req, res) => {
  const { sources, destination } = req.body;

  // assert sources is an array and destination is not null
  if (!Array.isArray(sources) || !destination) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
    });
  }

  console.log("Sources: ", sources);
  console.log("Destination: ", destination);

  try {
    const orderHashes = await executePlan(sources, destination);
    console.log("Plan executed successfully");
    res.status(201).json({
      success: true,
      message: "Plan executed successfully",
      orderHashes,
    });
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).json({
      success: false,
      message: "Error executing plan",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
