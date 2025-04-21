// Bu kod merkletreejs ve keccak256 paketlerini kullanır
// npm install merkletreejs keccak256

const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

// Airdrop alıcıları ve miktarlarını tanımlayın
const recipients = [
  { address: "0QARfBT9PMJ_TjX8bUqFvI-ZMqixM7kY68_-7tmVm-khfOyj", amount: "30000000000" },  // 30 JETTON
  { address: "0QA_aYew2jqj8gNdkeg-KDw8YB8ovTkKNNj02aMwpAZxNwP5", amount: "70000000000" }, // 70 JETTON
];

// merkletreejs kütüphanesi ile Merkle ağacı oluştur
function createMerkleTree() {
  console.log("merkletreejs kütüphanesi ile Merkle ağacı oluşturuluyor...");
  
  // Leaf değerlerini hesapla - her alıcı için hash değeri
  const leaves = recipients.map(recipient => {
    // Adres ve miktar değerlerini birleştirip hash'leyin
    return keccak256(Buffer.from(`${recipient.address}:${recipient.amount}`));
  });

  // Merkle ağacını oluştur
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  
  // Merkle kök hash değerini al - bu değeri kontratınıza ekleyeceksiniz
  const merkleRoot = merkleTree.getRoot().toString('hex');
  console.log("Merkle Root (hex):", merkleRoot);
  console.log("Merkle Root (0x formatında):", '0x' + merkleRoot);
  
  // Her adres için kanıtları oluştur
  const proofs = {};
  recipients.forEach((recipient) => {
    const leaf = keccak256(Buffer.from(`${recipient.address}:${recipient.amount}`));
    const hexProof = merkleTree.getProof(leaf).map(x => '0x' + x.data.toString('hex'));
    
    proofs[recipient.address] = {
      amount: recipient.amount,
      proof: hexProof
    };
  });

  // Merkle kökünu BigInt'e çevir (TON kontratı için)
  const merkleRootBigInt = BigInt('0x' + merkleRoot);
  console.log("\nFunC kontratı için merkle_root değeri (BigInt):");
  console.log(merkleRootBigInt.toString());

  return { merkleRoot: '0x' + merkleRoot, merkleRootBigInt, proofs, merkleTree };
}

// Merkle ağacını oluştur
const { merkleRoot, merkleRootBigInt, proofs, merkleTree } = createMerkleTree();

// Test doğrulama
const testAddress = recipients[0].address;
const testAmount = recipients[0].amount;
const testLeaf = keccak256(Buffer.from(`${testAddress}:${testAmount}`));
const testProof = merkleTree.getProof(testLeaf);

console.log("\nTest doğrulaması:");
const isValid = merkleTree.verify(testProof, testLeaf, merkleTree.getRoot());
console.log(`Adres: ${testAddress}, Doğrulama: ${isValid ? 'Başarılı' : 'Başarısız'}`);

// Kanıtları JSON dosyasına kaydet
const fs = require('fs');
fs.writeFileSync('merkle_proofs.json', JSON.stringify(proofs, null, 2));
console.log("\nMerkle kanıtları merkle_proofs.json dosyasına kaydedildi");

console.log("\nÖnemli: Bu merkle_root değerini Jetton kontratını dağıtırken kullanacaksınız:");
console.log(merkleRootBigInt.toString());