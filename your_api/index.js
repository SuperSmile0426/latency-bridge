const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const port = process.env.PORT || 3200;
const clientUrl = process.env.CLIENT || "http://localhost:3100";
const thirdPartyUrl = process.env.THIRD_PARTY || "http://localhost:3000";
const webhookUrl = process.env.WEBHOOK || "http://localhost:3200/hookTxStatus";

const transactions = {};

const simulateLatency = (latency) => {
  return new Promise((fn) => setTimeout(fn, latency));
};

const checkTxStatus = (id) => {
  if (!transactions[id]) return;
  if (transactions[id] === "completed" || transactions[id] === "declined")
    return;
  axios
    .get(`${thirdPartyUrl}/transaction/${id}`)
    .then((response) => {
      const { id, status } = response.data;
      if (transactions[id] === status) return;
      axios
        .put(`${clientUrl}/transaction`, { status: { id, status } })
        .catch(() => {
          console.log("A Error with calling client.");
        });
    })
    .catch((e) => {
      if (e.response.status == 404) {
        return;
      }
      console.log(`Could not check transaction status for ${id}`);
    });
};

app.post("/transaction", (req, res) => {
  const id = req.body.id;

  if (transactions[id] === "pending") {
    res.send({ id: id, status: "pending" });
    return;
  }

  transactions[id] = "pending";
  res.send({ id, status: transactions[id] });

  axios
    .post(`${thirdPartyUrl}/transaction`, { id, webhookUrl })
    .then((response) => {
      const { id, status } = response.data;
      transactions[id] = status;
      axios
        .put(`${clientUrl}/transaction`, { status: { id, status } })
        .catch(() => {
          console.log("Error with calling client.");
        });
    })
    .catch((e) => {
      if (e.response.status === 504) {
        transactions[id] = "timeout";
        axios
          .put(`${clientUrl}/transaction`, { status: { id, status: "timeout" } })
          .catch(() => {
            console.log("Error with calling client.");
          });
      } else {
        console.log("Error with calling third party.");
      }
    });

  simulateLatency(120_000).then(() => checkTxStatus(id));
});

app.post("/hookTxStatus", (req, res) => {
  const { id, status } = req.body;
  if (transactions[id] === status) {
    res.send();
    return;
  }
  transactions[id] = status;
  axios
    .put(`${clientUrl}/transaction`, { status: { id, status } })
    .catch((e) => {
      console.log("A Error with calling client.", e.response.status);
    });
  res.send();
});

app.listen(port, () => {
  console.log(`Your API is running on port ${port}`);
});
