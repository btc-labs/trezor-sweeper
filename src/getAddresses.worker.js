var bitcoin = require('bitcoinjs-lib')
var eu = require('ethereumjs-util')

self.addEventListener('message', function(e) {
        console.log('Message received from main script');
        let i = e.data['index']
        let publicKey = e.data['publicKey']
        let ethereum = e.data['ethereum']
        let chainCode = e.data['chainCode']
        const neuteredKeyPair = bitcoin.ECPair.fromPublicKeyBuffer(Buffer.from(publicKey, 'hex'), ethereum)
        const neutered = new bitcoin.HDNode(neuteredKeyPair, Buffer.from(chainCode, 'hex'))
        var publicKeyBuffer = neutered.derivePath("0/"+i).getPublicKeyBuffer()
        var addr_buf = eu.pubToAddress(publicKeyBuffer, true)
        var addr = addr_buf.toString('hex')
        let checkSum = eu.toChecksumAddress(addr)
        let workerResult = checkSum
        postMessage(workerResult);
    }
)
