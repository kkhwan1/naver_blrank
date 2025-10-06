import axios from 'axios';
import * as cheerio from 'cheerio';

async function analyzeMilkit() {
  try {
    const keyword = '밀키트';
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
    
    console.log('\n=== 밀키트 스마트블록 제목 분석 ===\n');
    
    // 1. fds-comps-header-headline
    const fdsHeaders = $('[class*="fds-comps-header-headline"]');
    console.log(`1. fds-comps-header-headline: ${fdsHeaders.length}개`);
    fdsHeaders.each((i, el) => {
      console.log(`   - ${$(el).text().trim()}`);
    });
    
    // 2. sds-comps-text-type-headline1
    const sdsHeadlines = $('[class*="sds-comps-text-type-headline1"]');
    console.log(`\n2. sds-comps-text-type-headline1: ${sdsHeadlines.length}개`);
    sdsHeadlines.each((i, el) => {
      console.log(`   - ${$(el).text().trim()}`);
    });
    
    // 3. fds-comps-footer-more-subject
    const fdsFooter = $('[class*="fds-comps-footer-more-subject"]');
    console.log(`\n3. fds-comps-footer-more-subject: ${fdsFooter.length}개`);
    fdsFooter.each((i, el) => {
      console.log(`   - ${$(el).text().trim()}`);
    });
    
    // 4. 모든 headline 관련 클래스 찾기
    const allHeadlines = $('[class*="headline"]');
    console.log(`\n4. 모든 headline 클래스: ${allHeadlines.length}개`);
    const uniqueTexts = new Set();
    allHeadlines.each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 0 && text.length < 50) {
        uniqueTexts.add(text);
      }
    });
    console.log('\n고유 텍스트:');
    Array.from(uniqueTexts).forEach(text => {
      console.log(`   - ${text}`);
    });
    
    // 5. 블로그 링크가 있는 섹션의 상위 제목 찾기
    console.log('\n5. 블로그 링크 근처의 제목 분석:');
    const blogLinks = $('a[href*="blog.naver.com"]');
    const titleClasses = new Set();
    blogLinks.slice(0, 5).each((i, el) => {
      const $link = $(el);
      // 상위 컨테이너에서 제목 찾기
      const $section = $link.closest('[class*="area"]').length > 0 
        ? $link.closest('[class*="area"]')
        : $link.closest('div').parent().parent().parent();
      
      const title = $section.find('[class*="headline"]').first();
      if (title.length > 0) {
        const classes = title.attr('class');
        const text = title.text().trim();
        titleClasses.add(classes);
        if (i === 0) {
          console.log(`   블로그 #${i+1} 섹션:`);
          console.log(`     클래스: ${classes}`);
          console.log(`     텍스트: ${text}`);
        }
      }
    });
    
    console.log('\n사용된 제목 클래스 패턴:');
    Array.from(titleClasses).forEach(cls => {
      console.log(`   - ${cls}`);
    });
    
  } catch (error) {
    console.error('오류:', error.message);
  }
}

analyzeMilkit();
