db = db.getSiblingDB('pems_bay');
db.createUser({ user:'pems_user', pwd:'pems_pass', roles:[{role:'readWrite',db:'pems_bay'}] });
db.createCollection('sensors');
db.createCollection('traffic_records');
print('Base pems_bay initialisée.');
