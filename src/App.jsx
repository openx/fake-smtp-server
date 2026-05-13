import { Component } from 'react';
import {
  Button,
  Container,
  Card,
  CardHeader,
  Row,
  Col,
  Collapse,
  ListGroup,
  ListGroupItem
} from 'reactstrap';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

function openAttachment (attachment) {
  var byteArray = new Uint8Array(attachment.content.data);
  var file = new Blob([byteArray], { type: attachment.contentType });
  var fileURL = URL.createObjectURL(file);
  window.open(fileURL);
}

const AddressList = ({ addrs }) => (
  <>
    {addrs.map((addr, i) => (
      <span key={i}>
        {i > 0 && ', '}
        {addr.name ? `${addr.name} ` : ''}
        &lt;<a href={`mailto:${addr.address}`}>{addr.address}</a>&gt;
      </span>
    ))}
  </>
);

function bodySrcDoc(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body>${html || ''}</body></html>`;
}

const Email = ({ email, isOpen, onToggle }) => {
  let from = email.from.value[0];
  let to = email.to.value[0];
  return (
    <Card>
      <CardHeader onClick={onToggle}>
        <Row>
          <Col className="px-2" md={4}>
            <div className="text-truncate">
              {from.name && from.name.length ? from.name : from.address}
            </div>
            <div className="text-truncate">
              {to.name && to.name.length ? to.name : to.address}
            </div>
          </Col>
          <Col className="px-2">
            {email.subject}
          </Col>
        </Row>
      </CardHeader>
      <Collapse isOpen={isOpen}>
        <ListGroup className="list-group-flush">
          <ListGroupItem>
            <strong>From:&nbsp;</strong>
            <AddressList addrs={email.from.value} />
          </ListGroupItem>
          <ListGroupItem>
            <strong>To:&nbsp;</strong>
            <AddressList addrs={email.to.value} />
          </ListGroupItem>
          <ListGroupItem>
            <strong>Date:&nbsp;</strong>
            <span title={dayjs(email.date).format('lll')}>{dayjs(email.date).fromNow()}</span>
          </ListGroupItem>
          <ListGroupItem>
            <strong>Subject:&nbsp;</strong>
            {email.subject}
          </ListGroupItem>
          <ListGroupItem hidden={email.attachments.length === 0}>
            <b>Attachments: </b>
            <div>
              {email.attachments.map(attachment => (
                <Button size="sm" className="me-1" onClick={() => openAttachment(attachment)}>
                  {attachment.filename}
                </Button>
              ))}
            </div>
          </ListGroupItem>
        </ListGroup>
        <div className="card-body p-0">
          <iframe
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={bodySrcDoc(email.html || email.textAsHtml)}
            title="Email body"
            style={{ width: '100%', height: '400px', border: 0 }}
          />
        </div>
      </Collapse>
    </Card>
  )
};

function removeTrailingSlash(url) {
  return url.replace(/\/$/, "");
}

const baseUrl = import.meta.env.DEV
  ? 'http://localhost:1080'
  : removeTrailingSlash(`${window.location.origin}${window.location.pathname}`);

class App extends Component {

  state = {
    emails: null,
    activeEmail: null
  };

  componentDidMount() {
      let request = {
          credentials: 'same-origin',
      };
      fetch(`${baseUrl}/api/emails`, request)
          .then(resp => resp.json())
          .then(emails => {
              this.setState({emails: emails});
          });
  }

  handleToggle = email => () => {
    if (this.state.activeEmail === email.messageId) {
      this.setState({ activeEmail: null });
    } else {
      this.setState({ activeEmail: email.messageId });
    }
  };

  render() {
    const isLoading = !this.state.emails;
    const isEmpty = !isLoading && this.state.emails.length === 0;
    const hasEmails = !isLoading && !isEmpty;
    return (
      <Container>
        <header>
          <h1 className="my-4">
            Emails
          </h1>
        </header>
        { hasEmails && this.state.emails.map(email => (
          <Email email={email}
                 isOpen={this.state.activeEmail === email.messageId}
                 onToggle={this.handleToggle(email)}
                 key={email.messageId} />
          ))
        }
        { isEmpty && (
          <div className="alert alert-info">
            Empty mailbox
          </div>
        ) }
      </Container>
    );
  }
}

export default App;
