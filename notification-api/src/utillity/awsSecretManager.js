const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

const isLocal = false;
const secretName = process.env.AWS_SECRET_NAME;
const client = new SecretsManagerClient({
  region: "ap-south-1",
});

async function getSecret(secretName) {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const response = await client.send(command);
    const secretString = JSON.parse(response.SecretString);

    let secrets = [];

    for (let key in secretString) {
      secrets.push(JSON.parse(secretString[key]));
    }

    if (secrets.length === 0) {
      throw new Error("No Client Found!");
    }

    return secrets;
  } catch (error) {
    console.error("Error fetching secret:", error);
    throw error;
  }
}

module.exports = {
  loadClientSecret: () => getSecret(secretName),
};
