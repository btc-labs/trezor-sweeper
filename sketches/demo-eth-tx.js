var Ethereum = require("ethereumjs-lib");
var Transaction = Ethereum.Transaction;

//create a blank transaction
var tx = new Transaction();

// So now we have created a blank transaction but Its not quiet valid yet. We
// need to add some things to it. Lets start with 
tx.nonce = 0;
tx.gasPrice = 100;
tx.gasLimit = 1000;
tx.to = 0; //Sending to 0, therefore we are creating a contract
tx.value = 1000;
tx.data = null;

console.log("TX", tx)

var privateKey = new Buffer("e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109");
tx.sign(privateKey);

console.log("Signed TX", tx)

console.log("Total Amount of wei needed:" + tx.getUpFrontCost());


console.log("---Serialized TX----");

console.log(tx.serialize().toString("hex")); //serialize returns a buffer
console.log("--------------------");

