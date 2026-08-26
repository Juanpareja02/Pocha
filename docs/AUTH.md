# Autenticación

## Frontera

El servidor define `AuthService` y `TokenVerifier`. El gateway valida el token durante el handshake y guarda el principal en `socket.data`; los payloads no pueden suplantar el usuario.

## Desarrollo y tests

En `development` y `test` existe `DevelopmentTokenVerifier`, con tokens temporales `dev:guest_<id>`. `POST /auth/guest` genera un invitado nuevo y devuelve token y perfil. `POST /auth/development` crea una cuenta permanente de desarrollo para pruebas de ranked. `POST /auth/upgrade` vincula un invitado con un principal permanente conservando el mismo `User.id`, historial y estadísticas. Estas rutas y formatos de desarrollo están bloqueados en producción.

La app móvil solo habilita estas llamadas cuando se compila con
`--dart-define=POCHA_AUTH_MODE=development`. Las builds release usan por defecto
`external` y muestran una configuración pendiente en lugar de llamar a auth de
desarrollo por accidente.

## Producción

`ExternalTokenVerifier` se registra mediante el puerto Nest `AUTH_TOKEN_VERIFIER` y
usa `FirebaseAdminVerifier`. La verificación es asíncrona y delega en
`firebase-admin` para validar la firma, el proyecto/audience y la expiración del
ID token; después comprueba explícitamente `iss` y `aud` contra la configuración
de staging. El SDK usa Google Application Default Credentials, por ejemplo
mediante `GOOGLE_APPLICATION_CREDENTIALS`; la cuenta de servicio nunca se guarda
en el repositorio.

Configuración requerida para Firebase (`la-pocha-app`):

```text
AUTH_PROVIDER=external
AUTH_ISSUER_URL=https://securetoken.google.com/la-pocha-app
AUTH_AUDIENCE=la-pocha-app
GOOGLE_APPLICATION_CREDENTIALS=<ruta local o secreto montado>
```

Los tokens de Firebase Anonymous se convierten en invitados. Email y Google se
convierten en cuentas permanentes según el `sign_in_provider` del token,
conservando el mismo `User.id` interno una vez creado el perfil.

La app externa recibe la configuración Firebase mediante `--dart-define`:

```text
POCHA_FIREBASE_API_KEY
POCHA_FIREBASE_APP_ID
POCHA_FIREBASE_MESSAGING_SENDER_ID
POCHA_FIREBASE_PROJECT_ID
POCHA_GOOGLE_SERVER_CLIENT_ID
POCHA_GOOGLE_IOS_CLIENT_ID   # reservado para una futura release iOS
```

`FirebaseAuthPort` obtiene el ID token del SDK, lo envía como Bearer a
`/auth/me` y usa `/auth/upgrade` cuando una sesión anónima crea una cuenta
permanente. No se almacenan contraseñas ni claves privadas en la app.
`FirebaseAdmin.verifyIdToken` valida también la expiración; el backend rechaza
el error de token expirado y la app ejecuta `FirebaseAuth.signOut` (y el cierre
de sesión de Google cuando corresponde). La prueba interactiva de logout en
hardware queda pendiente junto con la QA física.

## Verificación local

El backend se ha probado contra Firebase Auth Emulator usando
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` y contra el proyecto externo
`la-pocha-app`. En ambos casos se creó un usuario anónimo y uno email, se hizo
login Email/Password, se validaron en `/auth/me`, se ejecutó la promoción
invitado → cuenta permanente conservando el ID canónico y se comprobó que un
token inválido devuelve HTTP 401. La prueba externa usó cuentas temporales que
se eliminaron al terminar.

Con `NODE_ENV=production` o `AUTH_PROVIDER=external`, el servidor rechaza
tokens de desarrollo. Si faltan el proyecto o las credenciales, la verificación
falla cerrado y devuelve un error de servicio; no hay credenciales inventadas.

Los perfiles tienen `id`, `username`, `displayName`, `avatarSeed`, proveedor, identificador externo, `isGuest`, estadísticas y timestamps. El username se normaliza, es único, tiene 3–20 caracteres y pasa por una lista desacoplada de reservados.

Ranked exige `isGuest=false`. La promoción se hace mediante el flujo de upgrade explícito y auditado; el repositorio busca después el principal externo y devuelve el mismo usuario canónico, evitando perder rating, historial o estadísticas.

La integración de código, la credencial ADC local y la configuración declarativa
de Firebase están preparadas. En `la-pocha-app` ya están activos Anonymous,
Email/Password y Google están configurados para la aplicación Android. El login
interactivo de Google requiere una cuenta de QA y un dispositivo/emulador, por
lo que queda como `CONFIGURED_NOT_VERIFIED` en el informe de staging. El código
de otros proveedores se conserva sin formar parte de Android 1.0.

Para regenerar la configuración pública Android sin depender del orden de otras
apps del proyecto, usar Firebase CLI con el app ID de `com.pocha.mobile`:

```powershell
firebase apps:list --project la-pocha-app
firebase apps:sdkconfig android <APP_ID_DE_com.pocha.mobile> --project la-pocha-app
```

El proyecto usa `FirebaseOptions` por `--dart-define`, por eso no hay un
`google-services.json` versionado. Si una integración nativa lo exige, se puede
guardar ese resultado solo como archivo local ignorado.
