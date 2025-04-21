
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { Address, beginCell, Cell } = require('@ton/core');
const { TonClient } = require('@ton/ton');
const { Op } = require('./JettonConstants');

const app = express();
app.use(cors());
app.use(express.json());

// Merkle proofs.json dosyasını okuyoruz
const proofs = JSON.parse(fs.readFileSync('merkle_proofs.json', 'utf-8'));

// Minter adresi - Jetton Master Adresi
const minterAddress = "EQCL7ilNT1hXNJc_T5iQ4mHjNRl_Poj-cw7EoadHQMMrrLj_"; 
const merkleRoot = 73477099393965920966297498838768787378984958807176615475761377358790687961624n;

const API_KEY = 'b5982aadb3cf1211ff804df20704e55ec92439365b39858a4c3990794f080126';


// TON Client kurulumu
const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  apiKey: API_KEY,
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
function createClaimPayload(proofData) {
  try {
    // proofData bir dizi olduğundan Cell oluşturmak için önce serileştirelim
    const proofCell = beginCell();
    
    // Proof dizisinin her elemanını (hex string) storeUint ile hücreye kaydet
    if (Array.isArray(proofData) && proofData.length > 0) {
      // İlk elemanı al
      const proofItem = proofData[0];
      
      // Hex string'i BigInt'e çevir
      const proofBigInt = BigInt(proofItem);
      
      // 256 bit olarak kaydet
      proofCell.storeUint(proofBigInt, 256);
    } else {
      throw new Error('Proof verisi geçersiz biçimde');
    }
    
    // JettonWallet wrapper'ındaki claimPayload metodunu taklit eder
    const payload = beginCell()
      .storeUint(Op.merkle_airdrop_claim, 32)    // airdrop_claim operation code
      .storeRef(proofCell.endCell())      // Merkle proof'u ref olarak ekle
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

    // Minter'dan jetton_data al
    const jettonDataResponse = await client.runMethod(
      Address.parse(minterAddress),
      "get_jetton_data",
      []
    );
    
    // Stack'ten elemanları doğru sırayla al
    // İlk iki eleman int, sonraki slice, son iki eleman cell
    const total_supply = jettonDataResponse.stack.readBigNumber(); // 1. eleman
    const is_mintable = jettonDataResponse.stack.readNumber(); // 2. eleman
    const admin_address = jettonDataResponse.stack.readAddress(); // 3. eleman 
    const content = jettonDataResponse.stack.readCell(); // 4. eleman
    const wallet_code = jettonDataResponse.stack.readCell(); // 5. eleman - ihtiyacımız olan kod!
    
    // JettonWallet için data hücresi oluştur
    const dataCell = beginCell()
      .storeUint(0, 4)  // status
      .storeCoins(0)    // balance
      .storeAddress(Address.parse(address))  // owner_address
      .storeAddress(Address.parse(minterAddress))  // jetton_master_address
      .storeUint(merkleRoot, 256)  // merkle_root
      .storeUint(0, 10)  // salt
      .endCell();
    
    // StateInit oluştur
    const stateInit = beginCell()
      .storeRef(wallet_code)
      .storeRef(dataCell)
      .endCell();
    
    const stateInitBase64 = stateInit.toBoc().toString('base64');
    
    // Response hazırla
    res.json({
      owner: address,
      jetton_wallet: jettonWalletAddress,
      custom_payload: custom_payload,
      state_init: stateInitBase64,  // Eklenen state_init değeri
      compressed_info: {
        amount: amount.toString(),
        start_from: Date.now(),
        expired_at: Date.now() + 365 * 24 * 60 * 60 * 1000
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
    const proofData = proofs[address].proof; // Bu bir dizi
    
    // Claim payload'ı oluştur - dizinin kendisini gönder
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