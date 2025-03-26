// Definição das tabelas do Supabase
export const tables = {
  tenants: {
    name: 'tenants',
    columns: {
      id: 'uuid',
      company_name: 'text',
      access_url: 'text',
      status: 'text',
      selected_modules: 'jsonb',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone',
      setup_status: 'text',
      customization: 'jsonb'
    }
  },
  tenant_users: {
    name: 'tenant_users',
    columns: {
      id: 'uuid',
      tenant_id: 'uuid',
      full_name: 'text',
      email: 'text',
      role: 'text',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone'
    }
  },
  customers: {
    name: 'customers',
    columns: {
      id: 'uuid',
      tenant_id: 'uuid',
      full_name: 'text',
      email: 'text',
      phone: 'text',
      address: 'jsonb',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone'
    }
  },
  pets: {
    name: 'pets',
    columns: {
      id: 'uuid',
      tenant_id: 'uuid',
      customer_id: 'uuid',
      name: 'text',
      species: 'text',
      breed: 'text',
      birth_date: 'date',
      gender: 'text',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone'
    }
  },
  services: {
    name: 'services',
    columns: {
      id: 'uuid',
      tenant_id: 'uuid',
      name: 'text',
      description: 'text',
      price: 'decimal',
      duration: 'integer',
      created_at: 'timestamp with time zone',
      updated_at: 'timestamp with time zone'
    }
  }
};

// SQL para criar as tabelas
export const createTablesSQL = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  access_url TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active',
  selected_modules JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  setup_status TEXT DEFAULT 'pending',
  customization JSONB DEFAULT '{}'
);

-- Create tenant_users table
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create pets table
CREATE TABLE IF NOT EXISTS pets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT,
  breed TEXT,
  birth_date DATE,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenants_access_url ON tenants(access_url);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pets_tenant_id ON pets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id);

-- Create RLS policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Tenant policies
CREATE POLICY "Tenants are viewable by authenticated users" ON tenants
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Tenants are insertable by authenticated users" ON tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tenants are updatable by authenticated users" ON tenants
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Tenant users policies
CREATE POLICY "Tenant users are viewable by authenticated users" ON tenant_users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Tenant users are insertable by authenticated users" ON tenant_users
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Tenant users are updatable by authenticated users" ON tenant_users
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Customers policies
CREATE POLICY "Customers are viewable by authenticated users" ON customers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Customers are insertable by authenticated users" ON customers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Customers are updatable by authenticated users" ON customers
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Pets policies
CREATE POLICY "Pets are viewable by authenticated users" ON pets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Pets are insertable by authenticated users" ON pets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Pets are updatable by authenticated users" ON pets
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Services policies
CREATE POLICY "Services are viewable by authenticated users" ON services
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Services are insertable by authenticated users" ON services
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Services are updatable by authenticated users" ON services
  FOR UPDATE USING (auth.role() = 'authenticated');
`; 