## Resolución de conflictos de merge en Git

Cuando `git` reporta un conflicto durante un `merge`, `pull` o `rebase`, cada archivo conflictivo mostrará bloques marcados como `<<<<<<<`, `=======` y `>>>>>>>`. En los editores modernos (como VS Code) esto aparece con los botones _Accept Current Change_, _Accept Incoming Change_ y _Accept Both Changes_. Sigue estos pasos:

1. **Inspecciona cada conflicto**: haz clic en el archivo y revisa las diferencias. La sección marcada como _current_ corresponde a lo que ya tienes localmente y la sección _incoming_ corresponde a lo que llega de la otra rama.
2. **Elige la opción correcta**:
   - Usa _Accept Current_ si quieres mantener tu versión local.
   - Usa _Accept Incoming_ si quieres descartar tu versión y quedarte con la versión remota.
   - Usa _Accept Both_ cuando necesites combinar manualmente información de ambos lados (por ejemplo, si cada uno modifica líneas distintas que deben convivir).
3. **Limpia los marcadores**: si tu editor no lo hace automáticamente, borra cualquier resto de `<<<<<<<`, `=======` o `>>>>>>>` y asegúrate de que el archivo compile/funcione.
4. **Prueba el proyecto**: ejecuta los comandos de verificación (por ejemplo, `python -m compileall backend main.py src` y `npm run build`) para confirmar que no rompiste nada.
5. **Marca los archivos como resueltos**: `git add <archivo>` después de resolver cada conflicto.
6. **Completa la operación**: ejecuta `git merge --continue`, `git rebase --continue` o realiza el `commit` si estabas en medio de un `pull`.

Si tienes dudas sobre qué versión conservar, revisa el historial (`git log --oneline`) o consulta con el equipo antes de decidir.
