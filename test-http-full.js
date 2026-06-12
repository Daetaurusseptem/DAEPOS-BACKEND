async function run() {
  try {
    const orderData = {
      table: "Test Table HTTP",
      clientName: "Juan",
      type: "dine_in",
      status: "pending", // Emulating frontend
      productsSold: [
        {
          product: "6a18034ba739fd5a8365615f",
          productName: "Capuccino Caliente",
          quantity: 1,
          unitPrice: 45,
          subtotal: 45,
          modifications: []
        }
      ],
      total: 45,
      discount: 0,
      company: "6a18034ba739fd5a83656121", // corpCompany
      branch: "6a18034ba739fd5a83656126", // branchHospitality
      cashRegister: "6a18034ba739fd5a83656134", // random register ID
      waiter: "6a18034ba739fd5a83656133"
    };

    const orderRes = await fetch('http://localhost:3000/api/pending-orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    const orderDataRes = await orderRes.json();
    console.log("Order Response:", orderDataRes);
  } catch(e) {
    console.error(e);
  }
}
run();
