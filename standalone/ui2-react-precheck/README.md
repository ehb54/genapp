# Standalone UI2 React Precheck Mock

This is a static hand-test page for GenApp issue 165. It is intentionally not a
generated GenApp target and does not touch `genapp_zazzie`.

Open `index.html` in a browser and click **Precheck**. The page simulates the
same action response vocabulary used by GenApp `type: "action"` fields:

- `set_fields`
- `clear_fields`
- `message`
- `dialog`

The mock also demonstrates conditional display of the precheck button and shows
that precheck is separate from normal Job Manager submit behavior.
