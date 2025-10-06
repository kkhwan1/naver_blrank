const axios = require('axios');
const cheerio = require('cheerio');

async function testParser() {
  try {
    const keyword = '천안가구단지';
    const response = await axios.get('https://search.naver.com/search.naver', {
      params: {
        where: 'nexearch',
        query: keyword,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    console.log('\n=== 검색 결과 HTML 구조 분석 ===\n');
    
    // 스마트블록 제목 찾기
    const smartBlockTitles = $('[class*="fds-comps-footer-more-subject"]');
    console.log(`스마트블록 제목 개수: ${smartBlockTitles.length}`);
    
    smartBlockTitles.each((i, el) => {
      console.log(`제목 ${i+1}: ${$(el).text().trim()}`);
    });
    
    // 블로그 링크 찾기
    const blogLinks = $('a[href*="blog.naver.com"]');
    console.log(`\n블로그 링크 총 개수: ${blogLinks.length}`);
    
    const uniqueUrls = new Set();
    blogLinks.each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('blog.naver.com')) {
        const match = href.match(/blog\.naver\.com\/([^/]+)\/(\d+)/);
        if (match && i < 10) {
          const url = `https://blog.naver.com/${match[1]}/${match[2]}`;
          if (!uniqueUrls.has(url)) {
            uniqueUrls.add(url);
            console.log(`  ${uniqueUrls.size}. ${url}`);
          }
        }
      }
    });
    
    console.log(`\n고유 블로그 URL 개수: ${uniqueUrls.size}`);
    
  } catch (error) {
    console.error('오류:', error.message);
  }
}

testParser();
