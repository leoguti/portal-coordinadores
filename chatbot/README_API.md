# TextIt API v2 - Capabilities Reference

## 🔑 Authentication
All requests require:
```
Authorization: Token YOUR_API_TOKEN
```

## 📋 Main Endpoints

### Flows (Flujos)
- **GET** `/api/v2/flows.json` - List all flows
- **GET** `/api/v2/flow_definitions.json` - Get flow definitions with nodes/actions
- **POST** `/api/v2/flow_definitions.json` - Create/Import flow
- **PUT** `/api/v2/flow_definitions.json` - Update existing flow

### Contacts (Contactos)
- **GET** `/api/v2/contacts.json` - List contacts
- **POST** `/api/v2/contacts.json` - Create contact
- **PUT** `/api/v2/contacts.json` - Update contact
- **DELETE** `/api/v2/contacts.json` - Delete contact

### Messages (Mensajes)
- **GET** `/api/v2/messages.json` - List messages
- **POST** `/api/v2/messages.json` - Send message

### Runs (Ejecuciones de Flujo)
- **GET** `/api/v2/runs.json` - List flow runs
- **POST** `/api/v2/runs.json` - Start flow for contacts

### Groups (Grupos)
- **GET** `/api/v2/groups.json` - List groups
- **POST** `/api/v2/groups.json` - Create group
- **PUT** `/api/v2/groups.json` - Update group

### Fields (Campos Personalizados)
- **GET** `/api/v2/fields.json` - List contact fields
- **POST** `/api/v2/fields.json` - Create field

### Campaigns (Campañas)
- **GET** `/api/v2/campaigns.json` - List campaigns
- **POST** `/api/v2/campaigns.json` - Create campaign

### Broadcasts (Difusiones)
- **GET** `/api/v2/broadcasts.json` - List broadcasts
- **POST** `/api/v2/broadcasts.json` - Send broadcast

### Labels (Etiquetas)
- **GET** `/api/v2/labels.json` - List message labels
- **POST** `/api/v2/labels.json` - Create label

## 🎯 What We Can Do

### With Flows:
✅ Download entire flow definition (JSON)
✅ Modify nodes, messages, actions locally
✅ Upload modified flow back to TextIt
✅ Create new flows programmatically
✅ Clone/backup flows

### With Contacts:
✅ Bulk import contacts
✅ Update contact fields
✅ Segment by groups
✅ Add/remove from groups

### With Messages:
✅ Send messages to specific contacts
✅ Query message history
✅ Filter by date/contact/group

### With Runs:
✅ Start flows for specific users
✅ Track flow execution
✅ Get results/responses

## 💡 Use Cases for This Project

1. **Flow Management** (Priority)
   - Edit chatbot flows from our portal
   - Version control for flows
   - A/B testing different versions

2. **Contact Sync**
   - Sync Coordinadores from Airtable → TextIt
   - Keep groups updated

3. **Automated Messages**
   - Send notifications about orders
   - Broadcast updates to coordinators

4. **Analytics Dashboard**
   - Track flow completion rates
   - Monitor message activity
   - User engagement metrics

## 🔐 Getting Your API Token

1. Login to TextIt: https://textit.com
2. Go to Settings → Account
3. Find "API Token" section
4. Copy your token

## 📦 Next Steps

Once we have the token:
1. Test authentication
2. Download current flows
3. Build flow editor interface
4. Implement upload functionality
