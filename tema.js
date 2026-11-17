// Aplica o tema escolhido em Ajustes antes de a página aparecer (evita piscar claro no tema escuro).
// Fica num arquivo próprio porque a CSP não permite <script> inline. Vale só para este aparelho.
(function(){
  try{
    var t=localStorage.getItem('leve-tema');
    if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
