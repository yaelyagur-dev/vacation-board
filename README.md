# לוח חופשות — הוראות התקנה

## דרישות
- Node.js מותקן במחשב (הורידי מ-nodejs.org)

## התקנה מקומית

```bash
# 1. פתחי טרמינל בתיקיית הפרויקט
cd vacation-app

# 2. התקיני חבילות
npm install

# 3. הרצי את האתר מקומית
npm run dev
```
האתר יפתח בכתובת http://localhost:5173

## פרסום ב-Vercel (בחינם)

1. גשי ל-vercel.com וצרי חשבון בחינם
2. לחצי "Add New Project"
3. גררי את תיקיית vacation-app לתוך Vercel
4. לחצי Deploy
5. תוך דקה תקבלי כתובת אתר!

## הגדרת מנהל ראשון

לאחר ההרשמה הראשונה:
1. גשי ל-Firebase Console
2. Firestore Database → users
3. מצאי את המשתמש שלך
4. שני את השדה role מ-"employee" ל-"admin"
