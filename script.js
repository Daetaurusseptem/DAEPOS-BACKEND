
const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/jaime/POS/backend/src/routes/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && !['authRoutes.ts', 'sysadminRoutes.ts', 'fileUploadRoutes.ts', 'subscriptionRoutes.ts'].includes(f));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('validarSuscripcion')) {
    content = content.replace(/import \{([^}]+)\} from '\.\.\/middleware\/jwtMiddleware';/, (match, p1) => {
      return \import { \, validarSuscripcion } from '../middleware/jwtMiddleware';\;
    });
    
    // Add validarSuscripcion after verifyToken
    content = content.replace(/verifyToken,/g, 'verifyToken, validarSuscripcion,');
    
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + file);
  }
}

