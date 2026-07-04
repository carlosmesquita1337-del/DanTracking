// Este arquivo é uma CÓPIA de referência do Apps Script que já está publicado
// no Google (vinculado à planilha "RemessasUnilog"). Editar este arquivo aqui
// NÃO tem efeito nenhum — ele só existe para você ter o código versionado no
// GitHub também. Qualquer alteração real precisa ser feita em:
// https://script.google.com/u/0/home/projects/1bJ9qNrddP5v3TiNN_zCi6Ka5IzCEwXMgYbMj88GJKvqSfq2SZeK-vrZB/edit
// (e depois reimplantada: Implantar > Gerenciar implantações > editar > Nova versão)
//
// RESUMO DA VERSÃO ATUAL (com login/permissões):
// Todo acesso é via doPost com um "action" no corpo JSON (nunca GET, para
// nunca colocar senha/token na URL). Ações disponíveis:
//   login, logout, me, data, counts,
//   adminListUsers, adminCreateUser, adminUpdateUser, adminDeactivateUser
// Usuários ficam na aba "Usuarios_Sistema" (Username, Nome, PasswordHash,
// Salt, Role, Permissoes, Ativo, CreatedAt), com senha guardada como hash
// HMAC-SHA256 salgado (nunca em texto puro). Sessões são tokens aleatórios
// guardados no CacheService por até 6 horas. Login errado 5 vezes seguidas
// para o mesmo usuário bloqueia novas tentativas por 15 minutos. Cada
// usuário só recebe, do próprio servidor, os dados das abas ("views") que
// estão na sua lista de permissões — um pedido de aba não permitida retorna
// {error:"sem_permissao"} mesmo que o pedido venha direto pela API.
//
// Este resumo (abaixo, em formato legível) reflete o comportamento real do
// script publicado, mas não é uma cópia caractere-por-caractere do código
// (que no editor fica em linhas únicas por função, ver nota no topo do
// projeto sobre o bug do editor com múltiplas linhas).

var SHEET_ID = '18al0Fym3loaL30UcCYl-xteo2gqKoAqx8yMI6wyf4vU';
var VIEW_KEYS = ['todos', 'atendidos', 'despachados', 'recebidos', 'atendidos7', 'despachados7', 'semremessa'];
var SESSION_TTL_SECONDS = 21600; // 6 horas (máximo permitido pelo CacheService)
var LOGIN_MAX_ATTEMPTS = 5;
var LOGIN_LOCK_SECONDS = 900; // 15 minutos de bloqueio após 5 tentativas erradas

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    if (action === 'login') return jsonOut_(handleLogin_(body));
    if (action === 'logout') return jsonOut_(handleLogout_(body));
    if (action === 'me') return jsonOut_(handleMe_(body));
    if (action === 'data') return jsonOut_(handleData_(body));
    if (action === 'counts') return jsonOut_(handleCounts_(body));
    if (action === 'adminListUsers') return jsonOut_(handleAdminListUsers_(body));
    if (action === 'adminCreateUser') return jsonOut_(handleAdminCreateUser_(body));
    if (action === 'adminUpdateUser') return jsonOut_(handleAdminUpdateUser_(body));
    if (action === 'adminDeactivateUser') return jsonOut_(handleAdminDeactivateUser_(body));
    return jsonOut_({ error: 'acao_invalida' });
  } catch (err) {
    return jsonOut_({ error: 'erro_interno', detalhe: err.message });
  }
}

// GET sempre desabilitado: toda a API é POST-only para nunca expor
// senha/token em query string.
function doGet(e) {
  return jsonOut_({ error: 'use_post' });
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getRemessasData_() { var SHEET_ID = '18al0Fym3loaL30UcCYl-xteo2gqKoAqx8yMI6wyf4vU'; var SHEET_NAME = 'Base_Remessas'; var ss = SpreadsheetApp.openById(SHEET_ID); var sheet = ss.getSheetByName(SHEET_NAME); var values = sheet.getDataRange().getValues(); var items = []; var solicitante = ''; var nReq = ''; var nRemessa = ''; for (var i = 1; i < values.length; i++) { var row = values[i]; var colA = (row[0] || '').toString().trim(); var colB = (row[1] || '').toString().trim(); if (colA === '') { if (colB.indexOf('Solicitante:') === 0) { solicitante = colB.split(':').slice(1).join(':').trim(); nReq = ''; nRemessa = ''; } else if (colB.indexOf('req.:') !== -1) { nReq = colB.split(':').slice(1).join(':').trim(); nRemessa = ''; } else if (colB.indexOf('remessa:') !== -1) { nRemessa = colB.split(':').slice(1).join(':').trim(); } continue; } var serial = row[8]; var qtdeSolic = parseQty_(row[9]); var lote = row[11]; var validade = row[12]; var qtdeAtendida = parseQty_(row[16]); var dataAtendimento = row[17]; var cargaTexto = (row[18] || '').toString().trim(); var qtdeRecebida = parseQty_(row[19]); var dataUltRecebimento = row[20]; var cargaMatch = cargaTexto.match(/N[º°]?\s*(\d+)\s*-\s*([^-]+?)\s*-\s*(.+)/); var cargaNumero = cargaMatch ? cargaMatch[1] : ''; var cargaStatus = cargaMatch ? cargaMatch[2].replace(/^\s+|\s+$/g,'') : ''; var dataDespacho = cargaMatch ? cargaMatch[3].replace(/^\s+|\s+$/g,'') : ''; var despachado = !!cargaMatch; var statusAtendimento = 'nao'; if (qtdeAtendida !== null && qtdeAtendida > 0) { statusAtendimento = (qtdeSolic !== null && qtdeAtendida >= qtdeSolic) ? 'total' : 'parcial'; } var statusRecebimento = 'nao'; if (qtdeRecebida !== null && qtdeRecebida > 0) { statusRecebimento = (qtdeAtendida !== null && qtdeRecebida >= qtdeAtendida) ? 'total' : 'parcial'; } items.push({ solicitante: solicitante, nReq: nReq, nRemessa: nRemessa, produtoCodigo: colA, produtoDescricao: colB, serial: serial, qtdeSolicitada: qtdeSolic, lote: lote, validade: validade, qtdeAtendida: qtdeAtendida, dataAtendimento: dataAtendimento, cargaNumero: cargaNumero, cargaStatusTexto: cargaStatus, dataDespacho: dataDespacho, despachado: despachado, statusAtendimento: statusAtendimento, qtdeRecebida: qtdeRecebida, dataUltRecebimento: dataUltRecebimento, statusRecebimento: statusRecebimento }); } return items; }

function getCoberturaMap_() { var SHEET_ID = '18al0Fym3loaL30UcCYl-xteo2gqKoAqx8yMI6wyf4vU'; var ss = SpreadsheetApp.openById(SHEET_ID); var sheet = ss.getSheetByName('Cobertura_Instituto'); var values = sheet.getDataRange().getValues(); var map = {}; for (var i = 1; i < values.length; i++) { var row = values[i]; var codigo = (row[0] || '').toString().trim(); if (codigo === '') continue; var produto = (row[1] || '').toString().trim(); var saldo150 = parseQty_(row[8]); var coberturaDias = parseQty_(row[9]); map[codigo] = { produto: produto, saldo150: saldo150, coberturaDias: coberturaDias }; } return map; }

function parseQty_(v) { if (v === '' || v === null || v === undefined) return null; if (typeof v === 'number') return v; var s = v.toString().trim(); if (s === '') return null; var cleaned = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(cleaned); return isNaN(n) ? null : n; }
