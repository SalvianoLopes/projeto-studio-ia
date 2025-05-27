# Projeto Gemini – Google AI Studio

Este repositório contém o resultado de um projeto criado com o Google AI Studio (Gemini).

## Objetivo
Analisar dados de vendas de um supermercado a partir de um arquivo Excel (`Supermercado.xlsx`, com dados na `Sheet1`). O projeto visa gerar visualizações interativas e um dashboard profissional para apresentar:
- Faturamento total por Estado (UF), Loja, Produto, Marca e Categoria.
- Evolução das vendas ao longo do tempo (mensal, trimestral).
- Comparação entre volume vendido e valor vendido.
- Ranking dos produtos mais vendidos (por volume e valor).
- Tendências e sazonalidades de vendas.
- Gráfico de dispersão entre quantidade vendida × valor vendido.
- Análise preditiva simples com projeção de vendas futuras.
O dashboard incluirá tabelas dinâmicas com filtros interativos (Data da venda, Loja, Estado (UF), Categoria do produto, Marca do produto) e permitirá a exportação de gráficos e tabelas.

## Estrutura do projeto
- `src/`: códigos da aplicação principal (HTML, CSS, TSX).
- `prompt/`: textos dos prompts utilizados para gerar o projeto.
- `docs/`: documentação adicional, como explicações e interações.
- `README.md`: este arquivo.

## Como foi criado
O projeto foi criado usando [Google AI Studio](https://aistudio.google.com) com engenharia de prompt e análise de contexto.

## Como usar
Clone o repositório. Para executar esta aplicação web específica, abra o arquivo `src/index.html` em seu navegador preferido.

```bash
git clone https://github.com/SEU_USUARIO/projeto-studio-ia.git
# Após clonar, navegue até a pasta do projeto e abra o arquivo src/index.html no navegador.
```
