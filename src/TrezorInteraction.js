import React, { Component } from 'react'
import Worker from './getAddresses.worker.js';

import {
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Header,
  Table,
} from 'semantic-ui-react'

const fetch = require("node-fetch")
var eu = require('ethereumjs-util')
var etx = require('ethereumjs-tx')
const stripHexPrefix = require('strip-hex-prefix')
const NETWORK_LIST = {
  ethereum: {
    messagePrefix: '\x19Ethereum Signed Message:\n',
    bip32: {
      public: 0xffffffff,
      private: 0xffffffff
    },
    pubKeyHash: 0xff,
    scriptHash: 0x05,
    wif: 0xff,
    ethereum : true
  }
}
class TrezorInteraction extends Component {
  
  state = {
    currency: 'ETH',
    progress: 'Connecting to Trezor',
    addresses: [],
    balances: [],
    log: [],
    home: '',
    broadcastTransactions: false,
    offset: 0,
    pageSize: 500

  }

  componentDidMount() {
    this.connectToTrezor()
  }


  connectToTrezor = () => {
    var path = "m/44'/60'/0'"
    const recordPubKey = this.recordPubKey

    window.TrezorConnect.getXPubKey(path, function (response) {
      if (response.success) {
        recordPubKey({currency: 'ETH', chainCode: response.chainCode, publicKey: response.publicKey})
      } else {
        console.error('Error: ', response.error); // error message
      }
    })
  }

  recordPubKey = (publicKey) => {
    this.setState({publicKey: publicKey})
    this.setProgress('Public Key extracted')
  }
  generateAddresses = (publicKey, chainCode) => {
      let addresses = []
      let count = 0 
      let myWorker
      const length = (this.state.pageSize*this.state.offset + this.state.pageSize)
      try  {
        myWorker = new Worker()
      } catch(e) {
        throw new Error('Web workers unsupported')
      }
      for (var i = this.state.pageSize*this.state.offset; i < (length); i++) {
        
        myWorker.postMessage({index: i, chainCode, publicKey, ethereum: NETWORK_LIST.ethereum })
      }
      myWorker.onmessage = (e) => {
        addresses.push(e.data)
        console.log(e)
        count++
        if ((count % 10) === 0) {
          console.log("Address: ", i)
          this.setProgress(`Generated ${count} addresses`)
        }
        if (addresses.length === length) {
          this.setState({addresses: addresses, home: addresses[0]})
          this.setProgress(`Ready to fetch balances from Etherscan`)
        }
      }
  }
  

  sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getBalances = async () => {
    let balances = {}
    const addresses = this.state.addresses

    for (var i = this.state.pageSize*this.state.offset; i < this.state.pageSize*this.state.offset + this.state.pageSize; i++) {
      this.setProgress(`Checking address: ${i}, Addresses with balances: ${Object.keys(balances).length}`)
      await this.sleep(100)
      const balanceResponse = await fetch(`https://api.etherscan.io/api?module=account&action=balance&address=${addresses[i]}&tag=latest&apikey=K2AFIGD89RXCPZQBCBMBVVSK5PA5GEYNRB`)
      const balanceData = await balanceResponse.json()
      
      if (+balanceData.result > 0) {
        balances[i] = ({i, balance: +balanceData.result, address: addresses[i]})
      }
      
      this.setState({ balances })
    }
    this.setProgress("Finished checking balances")
  }

  toggleBroadcastTransactions = () => {
    this.setProgress("Toggled live mode")
    this.setState({broadcastTransactions: !this.state.broadcastTransactions})
  }

  setProgress = (message) => {
    this.setState({
      progress: message,
      log: this.state.log.concat(message)
    }) 
  }

  sendMoneyHome = async (index, address, amount) => {
    this.setProgress('Preparing transaction')
    var broadcastTransactions = this.state.broadcastTransactions

    var address_n = `m/44'/60'/0'/0/${index}` 

    var txCountResponse = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_getTransactionCount&address=${address}&tag=latest&apikey=K2AFIGD89RXCPZQBCBMBVVSK5PA5GEYNRB`)
    var txCountData = await txCountResponse.json()
    var nonce = '0' + stripHexPrefix(txCountData.result); // note - it is hex, not number!!!
    var gas_price = 1000000000
    gas_price = gas_price.toString(16)
    var gas_limit = 21000
    gas_limit = gas_limit.toString(16)
    var to = stripHexPrefix(this.state.home)
    var value = (amount - 1000000000 * 21000).toString(16)
    var data = null  // for no data
    var chain_id = 1 // 1 for ETH, 61 for ETC
    var rawTx

    window.TrezorConnect.ethereumSignTx(
      address_n,
      nonce,
      gas_price,
      gas_limit,
      to,
      value,
      data,
      chain_id,
      async (response) => {
        if (response.success) {

          rawTx = {
            nonce: eu.addHexPrefix(nonce),
            gasPrice: eu.addHexPrefix(gas_price),
            gasLimit: eu.addHexPrefix(gas_limit),
            to: eu.addHexPrefix(to),
            value: eu.addHexPrefix(value),
            data: null,
            v: response.v,
            r: new Buffer(response.r, 'hex'),
            s: new Buffer(response.s, 'hex')
          }

          console.log("Raw tx: ", rawTx)
          console.log("response", response)
          const tx = new etx(rawTx)

          const serializedTx = tx.serialize()
          console.log(serializedTx)
          const hexTx = eu.bufferToHex(serializedTx)
          console.log("Hex tx", hexTx)
          if (broadcastTransactions) {
            this.setProgress('Broadcasting transaction')
            const broadcastResponse = await fetch(`https://api.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex=${hexTx}&apikey=K2AFIGD89RXCPZQBCBMBVVSK5PA5GEYNRB`)
            const broadcastData = await broadcastResponse.json()
            this.setProgress(`Broadcasted transaction: ${broadcastData.result} `)
            console.log("Result", broadcastData)
          } else {
            this.setProgress(`Mock swept address ${address}`)
          }

        } else {
          console.error('Error:', response.error); // error message
        }
      }
    )
  }

  incrementPage = () => {
    this.setState({
      offset: this.state.offset+1
    })
  }

  decrementPage = () => {
    if (this.state.offset > 0) {
      this.setState({
        offset: this.state.offset-1
      })
    }
  }

  render() {
    return <Grid container stackable>
      <Grid.Row>
        <Grid.Column width={12}>
          <Header as='h3' style={{ fontSize: '1.5em' }}>{this.state.progress}</Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={8}>
          <Card>
            <Header as='h3' style={{ fontSize: '1.5em' }}>
              Page Size: {this.state.pageSize}, Page: {this.state.offset}
            </Header>
            <Header as='h3' style={{ fontSize: '0.75em' }}>
              {this.state.pageSize*this.state.offset} - {this.state.pageSize*this.state.offset + this.state.pageSize}
            </Header>

            <Button onClick={this.decrementPage}>Back</Button>
            <Button onClick={this.incrementPage}>Forward</Button>
          </Card>
          <Button size='huge' 
            style={{margin: '1em'}} 
            onClick={() => {this.generateAddresses(this.state.publicKey.publicKey, this.state.publicKey.chainCode) }}>1.  Generate Addresses</Button>
          <Button size='huge' style={{margin: '1em'}} onClick={this.getBalances}>2.  Get Balances</Button>

          <Checkbox 
            label='Broadcast Transactions (Live mode)' 
            checked={this.state.broadcastTransactions} 
            onClick={this.toggleBroadcastTransactions} />
          <Divider />
          {this.state.log.reverse().map((message, i) => {
            return <div key={i}>{message}</div>
          })}
        </Grid.Column>
        <Grid.Column width={4}>
          <Table attached='top' basic verticalAlign='top'>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Address</Table.HeaderCell>
                <Table.HeaderCell>Balance</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {Object.keys(this.state.balances).map((i) => {
                const balanceItem = this.state.balances[i]
                return  <Table.Row key={balanceItem.address} onClick={() => { this.sendMoneyHome(balanceItem.i, balanceItem.address, balanceItem.balance) }}>
                    <Table.Cell>{balanceItem.address}</Table.Cell>
                    <Table.Cell>{balanceItem.balance / 1e18}</Table.Cell>
                  </Table.Row>
              })}
            </Table.Body>
          </Table>
        </Grid.Column>
      </Grid.Row>
    </Grid>
      
  }
}

export default TrezorInteraction
