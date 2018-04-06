import React, { Component } from 'react'

import {
  Container,
} from 'semantic-ui-react'

import TrezorInteraction from './TrezorInteraction'

class App extends Component {
  render() {
    return (
      <Container>
        <TrezorInteraction />
      </Container>
    )
  }
}




export default App
