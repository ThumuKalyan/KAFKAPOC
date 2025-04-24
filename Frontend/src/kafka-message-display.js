import { LitElement, html, css } from 'lit';

class KafkaMessages extends LitElement {
  static properties = {
    kafkaMessages: { type: Array }, // Reactive property
  };

  constructor() {
    super();
    this.kafkaMessages = [];
    this.websocket = null; // Initialize WebSocket
  }

  connectWebSocket() {
    // Establish WebSocket connection
    this.websocket = new WebSocket('ws://localhost:3001');

    // Listen for incoming WebSocket messages
    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data); // Assuming the data is JSON
      console.log('WebSocket message received:', message);

      // Update `kafkaMessages` with the new data
      this.kafkaMessages = [...this.kafkaMessages, message];
    };

    // Handle errors
    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Handle WebSocket connection closure
    this.websocket.onclose = () => {
      console.log('WebSocket connection closed');
    };
  }

  connectedCallback() {
    super.connectedCallback();
    this.connectWebSocket(); // Start WebSocket connection
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.websocket) {
      this.websocket.close(); // Clean up WebSocket connection when the component is removed
    }
  }

  render() {
    return html`
      <div>
        <h3>Kafka Messages</h3>
        <ul>
          ${this.kafkaMessages.map(
            (message, index) =>
              html`<li key=${index}>
                File Name: ${message.filename}, Size: ${message.size} bytes
              </li>`
          )}
        </ul>
      </div>
    `;
  }

  static styles = css`
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      background: #f9f9f9;
      margin: 5px 0;
      padding: 10px;
      border: 1px solid #ddd;
    }
  `;
}   

customElements.define('kafka-messages', KafkaMessages);