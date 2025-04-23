// merkle-tree.js
// Bu kod merkletreejs ve keccak256 paketlerini kullanır
// npm install merkletreejs keccak256 @ton/core fs

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const fs = require('fs');

// Airdrop alıcıları ve miktarlarını tanımlayın
const recipients = [
  { address: "0QARfBT9PMJ_TjX8bUqFvI-ZMqixM7kY68_-7tmVm-khfOyj", amount: "30000000000" },  // 30 JETTON
  { address: "0QA_aYew2jqj8gNdkeg-KDw8YB8ovTkKNNj02aMwpAZxNwP5", amount: "70000000000" }, // 70 JETTON
];

// merkletreejs kütüphanesi ile Merkle ağacı oluştur
function createMerkleTree() {
  console.log("merkletreejs kütüphanesi ile Merkle ağacı oluşturuluyor...");
  
  // Her kullanıcı için start_from ve expire_at ekliyoruz
  const now = Math.floor(Date.now() / 1000);
  const oneYearLater = now + 365 * 24 * 60 * 60;
  
  // Recipient verilerine timestamp bilgilerini ekleyelim
  const enrichedRecipients = recipients.map(recipient => ({
    ...recipient,
    start_from: now,
    expire_at: oneYearLater
  }));
  
  // Leaf değerlerini hesapla - her alıcı için hash değeri
  const leaves = enrichedRecipients.map(recipient => {
    // Adres, miktar, başlangıç ve bitiş zamanlarını birleştirip hash'leyin
    return keccak256(Buffer.from(`${recipient.address}:${recipient.amount}:${recipient.start_from}:${recipient.expire_at}`));
  });

  // Merkle ağacını oluştur
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  
  // Merkle kök hash değerini al - bu değeri kontratınıza ekleyeceksiniz
  const merkleRoot = merkleTree.getRoot().toString('hex');
  console.log("Merkle Root (hex):", merkleRoot);
  console.log("Merkle Root (0x formatında):", '0x' + merkleRoot);
  
  // Her adres için kanıtları oluştur
  const proofs = {};
  enrichedRecipients.forEach((recipient, index) => {
    const leaf = keccak256(Buffer.from(`${recipient.address}:${recipient.amount}:${recipient.start_from}:${recipient.expire_at}`));
    const hexProof = merkleTree.getProof(leaf).map(x => '0x' + x.data.toString('hex'));
    
    proofs[recipient.address] = {
      amount: recipient.amount,
      start_from: recipient.start_from,
      expire_at: recipient.expire_at,
      proof: hexProof
    };
  });

  // Merkle kökünu BigInt'e çevir (TON kontratı için)
  const merkleRootBigInt = BigInt('0x' + merkleRoot);
  console.log("\nFunC kontratı için merkle_root değeri (BigInt):");
  console.log(merkleRootBigInt.toString());

  return { merkleRoot: '0x' + merkleRoot, merkleRootBigInt, proofs, merkleTree, enrichedRecipients };
}

// Merkle ağacını oluştur
const { merkleRoot, merkleRootBigInt, proofs, merkleTree, enrichedRecipients } = createMerkleTree();

// Test doğrulama
const testAddress = recipients[0].address;
const testAmount = recipients[0].amount;
const testLeaf = keccak256(Buffer.from(`${testAddress}:${testAmount}:${proofs[testAddress].start_from}:${proofs[testAddress].expire_at}`));
const testProof = merkleTree.getProof(testLeaf);

console.log("\nTest doğrulaması:");
const isValid = merkleTree.verify(testProof, testLeaf, merkleTree.getRoot());
console.log(`Adres: ${testAddress}, Doğrulama: ${isValid ? 'Başarılı' : 'Başarısız'}`);

// Kanıtları JSON dosyasına kaydet
fs.writeFileSync('merkle_proofs.json', JSON.stringify(proofs, null, 2));
console.log("\nMerkle kanıtları merkle_proofs.json dosyasına kaydedildi");

console.log("\nÖnemli: Bu merkle_root değerini Jetton kontratını dağıtırken kullanacaksınız:");
console.log(merkleRootBigInt.toString());

// Daha basit bir alternatif yaklaşım olarak, bir JSON dosyası oluşturalım
// Bu dosya airdropData.boc için gereken verilerin bir temsili olacak
const airdropDataJson = {
  merkleRoot: merkleRootBigInt.toString(),
  recipients: enrichedRecipients.map(recipient => ({
    address: recipient.address,
    amount: recipient.amount,
    start_from: recipient.start_from,
    expire_at: recipient.expire_at
  }))
};

fs.writeFileSync('airdropData.json', JSON.stringify(airdropDataJson, null, 2));
console.log("\nAlternatif olarak airdropData.json dosyasına JSON formatında kaydedildi");

// TON compatibility için API server kullanırken gerçek BOC'yi oluşturacak