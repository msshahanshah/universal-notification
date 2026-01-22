const {
    SecretsManagerClient,
    GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
const { Json } = require("sequelize/lib/utils");

const isLocal = false;

const client = new SecretsManagerClient({
    region: "ap-south-1",
});

/**
 * Fetch secret from AWS Secrets Manager
 */
(async function getSecret(secretName) {
    try {
        const command = new GetSecretValueCommand({
            SecretId: secretName,
        });

        const res = await client.send(command);
        const secret = JSON.parse(res.SecretString);
        // console.log(secret)
        // console.log(secret);

        for (const values of secret){
            console.log(values);
            // console.log(JSON.parse(key));
        }
        const credentials = JSON.parse(secret.ACCEL);
        // console.log(credentials)
        // console.log(typeof credentials);
        // console.log(credentials);
        if(Array.isArray(credentials)){
            console.log("Array")
        }
    } catch (error) {
        console.error("Error fetching secret:", error);
        throw error;
    }
})("Universal-Notifier");