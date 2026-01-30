// Script para ver cómo Airtable almacena los attachments
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appniHwKiUMS0imXD";

async function checkAttachment() {
  const response = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/ORDENES?filterByFormula=NOT({PDF}='')&maxRecords=3`,
    {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    }
  );
  
  const data = await response.json();
  if (data.records && data.records.length > 0) {
    console.log("Found", data.records.length, "orders with PDF");
    data.records.forEach(record => {
      console.log("\n--- Orden #" + record.fields.NumeroOrden);
      console.log("PDF attachment:");
      console.log(JSON.stringify(record.fields.PDF, null, 2));
    });
  } else {
    console.log("No orders with PDF found");
  }
}

checkAttachment();
