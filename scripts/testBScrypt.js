import bcrypt from 'bcryptjs';

const testPassword = 'Testando123';

async function testBcrypt() {
  console.log(`Testing bcryptjs with password: "${testPassword}"`);

  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    console.log('Salt generated.');
    const hash = await bcrypt.hash(testPassword, salt);
    console.log(`Password hashed: ${hash}`);

    // Compare the original password with the generated hash
    console.log('Comparing original password with the generated hash...');
    const isMatch = await bcrypt.compare(testPassword, hash);
    console.log(`Comparison result: ${isMatch}`);

    if (isMatch) {
      console.log('✅ bcryptjs hashing and comparison successful!');
    } else {
      console.error('❌ ERROR: bcryptjs comparison failed!');
    }

    // Test comparison with a known hash from the logs (optional, sanity check)
    const knownHash = '$2b$10$It7rcyZg9Ia2yMLWpN254OBWrA1DXTpU14qK0jRohdFmhRsin/rnu';
    console.log(`\nComparing original password with the KNOWN hash from logs: ${knownHash}`);
    const isMatchKnown = await bcrypt.compare(testPassword, knownHash);
    console.log(`Comparison with known hash result: ${isMatchKnown}`);
     if (isMatchKnown) {
      console.log('✅ bcryptjs comparison with known hash successful!');
    } else {
      console.error('❌ ERROR: bcryptjs comparison with known hash failed!');
    }


  } catch (error) {
    console.error('Error during bcrypt test:', error);
  }
}

testBcrypt();