// Initialisation MongoDB pour PEMS-BAY
// Crée la base, l'utilisateur et les collections
db = db.getSiblingDB('pems_bay');
db.createUser({ user:'pems_user', pwd:'pems_pass', roles:[{role:'readWrite',db:'pems_bay'}] });
db.createCollection('sensors');        // Capteurs (chargés depuis metadata.csv)
db.createCollection('traffic_records'); // Enregistrements trafic (vide, PEMS-BAY.csv éliminé)
print('Base pems_bay initialisée.');
