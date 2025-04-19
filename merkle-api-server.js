// nodejs ve express kullanarak basit bir API sunucusu
// npm install express cors

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// 1. adımda oluşturduğumuz merkle_proofs.json dosyasını okuyoruz
const proofs = JSON.parse(fs.readFileSync('merkle_proofs.json', 'utf-8'));

// Merkle dumping - tüm alıcılar ve miktarlar listesi
const merkleData = Object.entries(proofs).map(([address, data]) => {
  return {
    address: address,
    amount: data.amount
  };
});

// Tam Merkle dump verilerini sunmak için endpoint
app.get('/merkle-dump.json', (req, res) => {
  res.json(merkleData);
});

// Belirli bir adres için kanıt almak için endpoint
app.get('/proof/:address', (req, res) => {
  const address = req.params.address;
  
  if (!proofs[address]) {
    return res.status(404).json({ error: 'Address not found in airdrop list' });
  }
  
  res.json({
    address: address,
    amount: proofs[address].amount,
    proof: proofs[address].proof
  });
});

// Özel payload API - cüzdanlar için
app.get('/custom-payload/:address', (req, res) => {
  const address = req.params.address;
  
  if (!proofs[address]) {
    return res.status(404).json({ 
      error: 'Address not found in airdrop list' 
    });
  }
  
  // TON cüzdanları için özel payload formatı
  const payload = {
    type: "claim_jetton",
    amount: proofs[address].amount,
    proof: proofs[address].proof
  };
  
  res.json(payload);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Merkle kanıt API sunucusu ${PORT} portunda çalışıyor`);
  console.log(`Merkle dump: http://localhost:${PORT}/merkle-dump.json`);
  console.log(`Kanıt API: http://localhost:${PORT}/proof/{address}`);
  console.log(`Özel payload API: http://localhost:${PORT}/custom-payload/{address}`);
});