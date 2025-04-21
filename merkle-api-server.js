// nodejs ve express kullanarak Jetton Claim API sunucusu
// npm install express cors @ton/core @ton/ton @ton/crypto

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Address, beginCell, Cell } = require('@ton/core');
const { TonClient } = require('@ton/ton');
const { Op } = require('./JettonConstants'); // Ayrı dosyada Op kodları tanımlı olmalı

const app = express();
app.use(cors());
app.use(express.json());

// Merkle proofs.json dosyasını okuyoruz
const proofs = JSON.parse(fs.readFileSync('merkle_proofs.json', 'utf-8'));

// Minter adresi - Jetton Master Adresi
const minterAddress = "kQDSSiCpYJRQ5KUIi0bfTvbVSkyWyiNB3uwwIk-HRJQiGXjQ"; 
const merkleRoot = 54805077308509371377276388286564341720497793142849174634196306266409738120967n;

// TON Client kurulumu
const client = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
  apiKey: "b5982aadb3cf1211ff804df20704e55ec92439365b39858a4c3990794f080126" // Kendi API anahtarınızla değiştirin
});

// JettonWallet adresini hesaplayan fonksiyon - JettonMinter wrapper'ından
async function calculateJettonWalletAddress(ownerAddress) {
  try {
    const userAddressCell = beginCell()
      .storeAddress(Address.parse(ownerAddress))
      .endCell();

    const response = await client.runMethod(
      Address.parse(minterAddress),
      "get_wallet_address",
      [{ type: "slice", cell: userAddressCell }]
    );

    return response.stack.readAddress().toString();
  } catch (error) {
    console.error('Error calculating jetton wallet address:', error);
    throw error;
  }
}

// Claim için gerekli payload'ı oluşturan fonksiyon - JettonWallet wrapper'ından
function createClaimPayload(proofBase64) {
  try {
    // Base64 formatındaki proof'u Cell'e dönüştür
    const proofCell = Cell.fromBase64(proofBase64);
    
    // JettonWallet wrapper'ındaki claimPayload metodunu taklit eder
    const payload = beginCell()
      .storeUint(Op.merkle_airdrop_claim, 32) // merkle_airdrop_claim operation code
      .storeRef(proofCell)                   // Merkle proof'u ref olarak ekle
      .endCell();
    
    return payload.toBoc().toString('base64');
  } catch (error) {
    console.error('Error creating claim payload:', error);
    throw error;
  }
}

// TON transferi için deep link oluşturan fonksiyon
function createTonDeepLink(toAddress, amount, payload) {
  // TON transfer deep link formatı
  return `ton://transfer/${toAddress}?amount=${amount}&bin=${payload}`;
}

// Jetton metadata endpoint
app.get('/jetton-metadata.json', (req, res) => {
  // Dosyadan metadata'yı oku
  const metadata = fs.readFileSync(__dirname + '/jetton-metadata.json', 'utf-8');
  res.setHeader('Content-Type', 'text/plain');
  res.send(metadata);
});

// Merkle dump verilerini sunmak için endpoint
app.get('/merkle-dump.json', (req, res) => {
  const merkleData = Object.entries(proofs).map(([address, data]) => {
    return {
      address: address,
      amount: data.amount
    };
  });
  
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

// Claim için gerekli bilgileri döndüren basit endpoint (kullanıcı dostu)
app.get('/claim/:address', async (req, res) => {
  const address = req.params.address;
  
  if (!proofs[address]) {
    return res.status(404).json({ 
      error: 'Address not found in airdrop list' 
    });
  }
  
  try {
    // Airdrop bilgilerini al
    const amount = proofs[address].amount;
    const proofData = proofs[address].proof;
    
    // Claim için gerekli payload'ı oluştur
    const custom_payload = createClaimPayload(proofData);
    
    // JettonWallet adresini hesapla
    const jettonWalletAddress = await calculateJettonWalletAddress(address);
    
    // TON transfer için deep link oluştur (0.05 TON ile)
    const tonDeepLink = createTonDeepLink(minterAddress, "0.05", custom_payload);
    
    // Kullanıcı dostu yanıt döndür
    res.json({
      address: address,
      amount: amount,
      jettonMaster: minterAddress,
      jettonWallet: jettonWalletAddress,
      claimInstructions: {
        step1: "Aşağıdaki 'Claim TON' düğmesine tıklayın veya deep link'i cüzdanınızda açın",
        step2: "Cüzdanınızda açılan transfer işlemini onaylayın",
        step3: "İşlem onaylandıktan sonra jetton'larınız cüzdanınıza otomatik olarak gelecektir"
      },
      claimURL: tonDeepLink,
      claimButtonHTML: `<a href="${tonDeepLink}" style="display:inline-block;background:#0088CC;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">Claim TON</a>`,
      technicalDetails: {
        custom_payload: custom_payload,
        proof: proofData
      }
    });
  } catch (error) {
    console.error('Error generating claim data:', error);
    res.status(500).json({ 
      error: 'Failed to generate claim data: ' + error.message 
    });
  }
});

// Cüzdanlar için claim endpoint'i - geliştiriciler için teknik detaylar
app.get('/wallet/:address', async (req, res) => {
  const address = req.params.address;
  
  if (!proofs[address]) {
    return res.status(404).json({ 
      error: 'Address not found in airdrop list' 
    });
  }
  
  try {
    // Airdrop bilgilerini al
    const amount = proofs[address].amount;
    const proofData = proofs[address].proof;
    
    // Claim için gerekli payload'ı oluştur
    const custom_payload = createClaimPayload(proofData);
    
    // JettonWallet adresini hesapla
    const jettonWalletAddress = await calculateJettonWalletAddress(address);
    
    // Şu anki timestamp ve geçerlilik süresi
    const currentTime = Math.floor(Date.now() / 1000);
    const expireTime = currentTime + 365 * 24 * 60 * 60; // 1 yıl geçerli
    
    // Response hazırla
    res.json({
      owner: address,
      jetton_wallet: jettonWalletAddress,
      custom_payload: custom_payload,
      compressed_info: {
        amount: amount.toString(),
        start_from: currentTime.toString(),
        expired_at: expireTime.toString()
      }
    });
  } catch (error) {
    console.error('Error generating claim data:', error);
    res.status(500).json({ 
      error: 'Failed to generate claim data: ' + error.message 
    });
  }
});

// Özel payload API - cüzdanlar için
app.get('/custom-payload/:address', async (req, res) => {
  const address = req.params.address;
  
  if (!proofs[address]) {
    return res.status(404).json({ 
      error: 'Address not found in airdrop list' 
    });
  }
  
  try {
    // Proof bilgisini al
    const amount = proofs[address].amount;
    const proofData = proofs[address].proof;
    
    // Claim payload'ı oluştur
    const payload = createClaimPayload(proofData);
    
    // JettonWallet adresini hesapla
    const jettonWalletAddress = await calculateJettonWalletAddress(address);
    
    // TON cüzdanları için özel payload formatı
    res.json({
      type: "claim_jetton",
      minter: minterAddress,
      jetton_wallet: jettonWalletAddress,
      merkle_root: merkleRoot.toString(),
      amount: amount,
      proof: proofData,
      payload: payload
    });
  } catch (error) {
    console.error('Error generating payload:', error);
    res.status(500).json({ 
      error: 'Failed to generate payload: ' + error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Merkle kanıt API sunucusu ${PORT} portunda çalışıyor`);
  console.log(`Jetton Metadata: http://localhost:${PORT}/jetton-metadata.json`);
  console.log(`Merkle dump: http://localhost:${PORT}/merkle-dump.json`);
  console.log(`Kanıt API: http://localhost:${PORT}/proof/{address}`);
  console.log(`Claim API (Kullanıcı dostu): http://localhost:${PORT}/claim/{address}`);
  console.log(`Wallet API (Teknik): http://localhost:${PORT}/wallet/{address}`);
  console.log(`Özel payload API: http://localhost:${PORT}/custom-payload/{address}`);
});