#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 스마트블록 다중 카테고리 스크래퍼 (v12 - Timeout 수정 + 카테고리 필터링)
키워드 하나로 모든 스마트블록 카테고리를 감지하고 블로그 목록을 추출합니다.

v12 Changes:
- Fixed timeout issue in batch_extract_in_naver_urls() (workers: 10→3, timeout: no limit→30s)
- Fixed timeout in extract_blog_from_in_naver() (timeout: 5s→3s, added retry logic)
- Added filtering logic to remove empty and duplicate categories
- Now properly extracts 20-30+ blogs with stable performance
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import sys
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Set
from concurrent.futures import ThreadPoolExecutor, as_completed


def get_naver_search_html(keyword: str) -> str:
    """네이버 검색 HTML 가져오기 (쿠키/헤더 포함)"""

    cookies = {
        'NNB': 'ECHGGL2ZR7AGO',
        'ASID': '7425f1d60000019564d162b600000055',
        'PM_CK_loc': '1dd76e4b80bc46c7d0d1adf34d89f5e27fc787c39dbf2aab1c87ad65a4e7d39a',
        'SHP_BUCKET_ID': '4',
        'nx_ssl': '2',
        'page_uid': 'j9SIYdp0JXVssLpE5EZssssstJV-155875',
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://search.naver.com/',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    }

    params = {
        'where': 'nexearch',
        'query': keyword,
    }

    try:
        response = requests.get(
            'https://search.naver.com/search.naver',
            params=params,
            cookies=cookies,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching Naver search page: {e}", file=sys.stderr)
        return ""


def parse_blog_url(url: str) -> Tuple[Optional[str], Optional[str]]:
    """블로그 URL에서 blogId, postId 추출"""

    # https://blog.naver.com/userid/postid 형식
    match = re.search(r'blog\.naver\.com/([^/]+)/(\d+)', url)
    if match:
        return match.group(1), match.group(2)

    # URL 파라미터 형식: logNo=123&blogId=abc
    match = re.search(r'blogId=([^&]+).*?logNo=(\d+)', url)
    if match:
        return match.group(1), match.group(2)

    return None, None


def extract_blog_from_in_naver(in_url: str, headers: dict, max_retries: int = 2) -> Optional[str]:
    """in.naver.com 링크에서 실제 blog.naver.com URL 추출 (v12: timeout 5s→3s, retry logic added)"""
    for attempt in range(max_retries + 1):
        try:
            response = requests.get(in_url, headers=headers, timeout=3, allow_redirects=True)
            
            # 최종 리다이렉션된 URL이 blog.naver.com인지 확인
            final_url = response.url
            if 'blog.naver.com' in final_url:
                return final_url
            
            # HTML에서 blog.naver.com 링크 찾기
            soup = BeautifulSoup(response.text, 'lxml')
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                if 'blog.naver.com' in href:
                    return href
            
            return None
        except requests.Timeout:
            if attempt < max_retries:
                continue  # Retry on timeout
            print(f"Timeout extracting from {in_url} after {max_retries + 1} attempts", file=sys.stderr)
            return None
        except Exception as e:
            print(f"Error extracting from {in_url}: {e}", file=sys.stderr)
            return None
    return None



def batch_extract_in_naver_urls(in_urls: Set[str], headers: dict, max_workers: int = 3) -> Dict[str, str]:
    """배치로 in.naver.com URL들을 blog.naver.com URL로 변환

    Returns:
        Dict mapping in_url -> blog_url
    """
    url_map = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_url = {
            executor.submit(extract_blog_from_in_naver, url, headers): url
            for url in in_urls
        }

        for future in as_completed(future_to_url, timeout=30):
            in_url = future_to_url[future]
            try:
                blog_url = future.result(timeout=3)
                if blog_url:
                    url_map[in_url] = blog_url
            except Exception as e:
                print(f"Error processing {in_url}: {e}", file=sys.stderr)

    return url_map


def extract_blogs_from_container(container, headers: dict) -> List[Dict]:
    """컨테이너에서 블로그 목록 추출 (v6 - 배치 최적화)

    3단계 프로세스:
    1. 모든 고유 in.naver.com/contents URL 수집
    2. 배치로 blog.naver.com URL 추출
    3. blog_items와 매칭하여 제목/썸네일 추출
    """

    blogs = []
    seen_posts = set()  # (blogId, postId) 튜플로 중복 체크

    # 1단계: 블로그 아이템 컨테이너 찾기
    blog_items = container.find_all('div', class_=lambda x: x and any(
        keyword in str(x).lower() for keyword in [
            'fds-article-simple-box',
            'fds-comps-right-image-desktop',
            'fds-ugc-body',
            'api-blogr-body',
            'blog-item',
            'post-item'
        ]
    ))

    # 컨테이너를 못 찾으면 전체를 하나의 컨테이너로 처리
    if not blog_items:
        blog_items = [container]

    # 2단계: in.naver.com URL 수집 (중복 제거)
    in_naver_urls = set()
    for item in blog_items:
        for link in item.find_all('a', href=True):
            href = link.get('href', '')
            if 'in.naver.com' in href and '/contents/' in href:
                in_naver_urls.add(href)

    # 3단계: 배치로 in.naver.com URL 변환
    in_to_blog_map = {}
    if in_naver_urls:
        in_to_blog_map = batch_extract_in_naver_urls(in_naver_urls, headers)

    # v10 FIX: influencer/location type (blog_items == 1) 처리
    if len(blog_items) == 1 and blog_items[0] == container:
        # 단일 컨테이너 내부의 모든 blog 링크 추출
        all_links = container.find_all('a', href=True)

        for link in all_links:
            href = link.get('href', '')
            blog_url = None
            blog_id = None
            post_id = None

            # 우선순위 1: blog.naver.com 직접 링크
            if 'blog.naver.com' in href:
                blog_id, post_id = parse_blog_url(href)
                if blog_id and post_id:
                    blog_url = href

            # 우선순위 2: in.naver.com 링크 (배치 추출된 결과 사용)
            elif href in in_to_blog_map:
                blog_url = in_to_blog_map[href]
                blog_id, post_id = parse_blog_url(blog_url)

            if not blog_url or not blog_id or not post_id:
                continue

            # 중복 체크
            post_key = (blog_id, post_id)
            if post_key in seen_posts:
                continue
            seen_posts.add(post_key)

            # 제목 추출
            title = link.get_text(strip=True) or link.get('aria-label', '') or link.get('title', '')
            if not title or len(title) < 3:
                title = f"블로그 포스트 ({blog_id})"

            blogs.append({
                'url': blog_url,
                'title': title,
                'blogId': blog_id,
                'postId': post_id,
                'thumbnail': None,
                'preview': title
            })

        return blogs

    # 4단계: 각 블로그 아이템에서 추출
    for item in blog_items:
        blog_url = None
        blog_id = None
        post_id = None
        title_link = None

        # 우선순위 1: blog.naver.com 직접 링크
        all_links = item.find_all('a', href=True)
        for link in all_links:
            href = link.get('href', '')
            if 'blog.naver.com' in href:
                blog_id, post_id = parse_blog_url(href)
                if blog_id and post_id:
                    blog_url = href
                    title_link = link
                    break

        # 우선순위 2: in.naver.com 링크 (배치 추출된 결과 사용)
        if not blog_url:
            for link in all_links:
                href = link.get('href', '')
                if href in in_to_blog_map:
                    blog_url = in_to_blog_map[href]
                    blog_id, post_id = parse_blog_url(blog_url)
                    if blog_id and post_id:
                        title_link = link
                        break

        # 우선순위 3: title 클래스가 있는 링크
        if not title_link:
            title_link = item.find('a', class_=lambda x: x and 'title' in str(x).lower())
            if title_link:
                href = title_link.get('href', '')
                if 'blog.naver.com' in href:
                    blog_id, post_id = parse_blog_url(href)
                    blog_url = href

        if not blog_url or not blog_id or not post_id:
            continue

        # 중복 체크
        post_key = (blog_id, post_id)
        if post_key in seen_posts:
            continue
        seen_posts.add(post_key)

        # 제목 추출 - 다양한 방법 시도
        title = ''

        # 방법 1: title 관련 클래스명 찾기
        title_elem = item.find(['span', 'div', 'strong', 'h3', 'h4'], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ['title', 'headline', 'subject', 'name']
        ))
        if title_elem:
            title = title_elem.get_text(strip=True)

        # 방법 2: 링크의 텍스트
        if not title and title_link:
            title = title_link.get_text(strip=True)

        # 방법 3: aria-label 또는 title 속성
        if not title and title_link:
            title = title_link.get('aria-label', '') or title_link.get('title', '')

        # 방법 4: 아이템 내부의 첫 번째 텍스트 요소
        if not title:
            for elem in item.find_all(['span', 'div', 'strong']):
                text = elem.get_text(strip=True)
                if text and len(text) > 5:
                    title = text
                    break

        # 썸네일 추출
        img = item.find('img')
        thumbnail = None
        if img:
            thumbnail = img.get('src') or img.get('data-src') or img.get('data-lazy-src')

        # 미리보기 텍스트 추출
        preview = None
        preview_elem = item.find(['span', 'div', 'p'], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ['desc', 'preview', 'text', 'content', 'dsc']
        ))
        if preview_elem:
            preview = preview_elem.get_text(strip=True)[:200]

        # 빈 제목 방지
        if not title or len(title) < 3:
            title = f"블로그 포스트 ({blog_id})"

        # 제목이 너무 긴 경우 자르기
        if len(title) > 100:
            title = title[:97] + "..."

        blogs.append({
            'url': blog_url,
            'title': title,
            'blogId': blog_id,
            'postId': post_id,
            'thumbnail': thumbnail,
            'preview': preview
        })

    return blogs



def scrape_lb_api_more_page(lb_api_url: str, cookies: dict, headers: dict, max_pages: int = 2) -> List[Dict]:
    """lb_api URL에서 블로그 목록 크롤링 (ugc_list 카테고리용)"""
    import urllib.parse
    import json
    
    all_blogs = []
    seen_posts = set()
    
    try:
        # lb_api URL 디코딩
        if lb_api_url.startswith('#lb_api='):
            api_url = urllib.parse.unquote(lb_api_url.split('#lb_api=', 1)[1])
        else:
            api_url = lb_api_url
        
        # API 호출
        response = requests.get(api_url, cookies=cookies, headers=headers, timeout=15)
        response.raise_for_status()
        
        # JSON 파싱
        data = response.json()
        
        # dom.collection[0].html에서 HTML 추출
        if 'dom' in data and 'collection' in data['dom']:
            collection = data['dom']['collection']
            if isinstance(collection, list) and len(collection) > 0:
                html_content = collection[0].get('html', '')
                
                if html_content:
                    # HTML 파싱
                    soup = BeautifulSoup(html_content, 'lxml')
                    
                    # 블로그 추출
                    page_blogs = extract_blogs_from_container(soup, headers)
                    
                    # 중복 제거하면서 추가
                    for blog in page_blogs:
                        post_key = (blog['blogId'], blog['postId'])
                        if post_key not in seen_posts:
                            seen_posts.add(post_key)
                            all_blogs.append(blog)
                    
                    print(f'lb_api에서 {len(page_blogs)}개 블로그 추출 (중복 제거 후: {len(all_blogs)}개)', file=sys.stderr)
        
    except Exception as e:
        print(f'Error scraping lb_api {lb_api_url[:50]}...: {e}', file=sys.stderr)
    
    return all_blogs




def scrape_ugc_list_with_playwright(more_link: str, keyword: str, headers: dict, headless: bool = False, max_pages: int = 2) -> List[Dict]:
    """Phase 2: Playwright MCP를 사용한 ugc_list 카테고리 크롤링 (lb_api fallback)"""
    
    all_blogs = []
    seen_posts = set()
    
    try:
        # lb_api URL 디코딩하여 실제 검색 URL 구성
        if more_link.startswith("#lb_api="):
            import urllib.parse
            # lb_api URL을 검색 URL로 변환
            # keyword로 새로 검색하는 것이 안전함
            search_url = f"https://search.naver.com/search.naver?where=blog&query={urllib.parse.quote(keyword)}"
        else:
            search_url = more_link if more_link.startswith("http") else f"https://search.naver.com{more_link}"
        
        print(f"Playwright 크롤링 시작 (headless={headless}): {search_url[:80]}...", file=sys.stderr)
        
        # Playwright MCP 도구 사용
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
        
        with sync_playwright() as p:
            # 브라우저 실행
            browser = p.chromium.launch(headless=headless)
            context = browser.new_context(
                user_agent=headers.get("User-Agent"),
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()
            
            # 네이버 검색 결과 페이지 이동
            page.goto(search_url, wait_until="networkidle", timeout=30000)
            
            # 페이지별 크롤링
            for page_num in range(1, max_pages + 1):
                print(f"Playwright 페이지 {page_num} 크롤링 중...", file=sys.stderr)
                
                # 페이지 로드 대기
                page.wait_for_timeout(2000)
                
                # 현재 페이지 HTML 추출
                html_content = page.content()
                soup = BeautifulSoup(html_content, "lxml")
                
                # 블로그 컨테이너 찾기
                containers = soup.find_all(["div", "section"], class_=lambda x: x and any(
                    keyword in str(x) for keyword in ["blog", "total", "lst", "api_subject"]
                ))
                
                page_blogs = []
                for container in containers:
                    container_blogs = extract_blogs_from_container(container, headers)
                    for blog in container_blogs:
                        post_key = (blog["blogId"], blog["postId"])
                        if post_key not in seen_posts:
                            seen_posts.add(post_key)
                            page_blogs.append(blog)
                            all_blogs.append(blog)
                
                print(f"페이지 {page_num}에서 {len(page_blogs)}개 신규 블로그 추출", file=sys.stderr)
                
                # 다음 페이지로 이동
                if page_num < max_pages:
                    try:
                        # "더보기" 버튼 찾기
                        more_button_selectors = [
                            "a:has-text('더보기')",
                            ".fds-comps-more-button-no-border a",
                            "button:has-text('더보기')",
                            "[aria-label*='더보기']"
                        ]
                        
                        button_found = False
                        for selector in more_button_selectors:
                            try:
                                if page.is_visible(selector, timeout=3000):
                                    page.click(selector)
                                    button_found = True
                                    print(f"더보기 버튼 클릭 성공: {selector}", file=sys.stderr)
                                    page.wait_for_timeout(3000)
                                    break
                            except:
                                continue
                        
                        if not button_found:
                            print(f"더보기 버튼을 찾을 수 없어 페이지 {page_num}에서 중단", file=sys.stderr)
                            break
                    
                    except PlaywrightTimeout:
                        print(f"더보기 버튼 타임아웃, 페이지 {page_num}에서 중단", file=sys.stderr)
                        break
                    except Exception as e:
                        print(f"더보기 버튼 클릭 실패: {e}", file=sys.stderr)
                        break
            
            # 브라우저 닫기
            browser.close()
        
        print(f"Playwright 크롤링 완료: 총 {len(all_blogs)}개 블로그 추출", file=sys.stderr)
    
    except Exception as e:
        print(f"Playwright 크롤링 실패: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    
    return all_blogs

def find_more_link(container) -> Optional[str]:
    """더보기 링크 찾기 (influencer + ugc_list 카테고리 지원)"""

    # 방법 1: container 내부에서 직접 찾기 (influencer 카테고리)
    # "더보기" 텍스트가 있는 링크 찾기
    more_link = container.find('a', string=lambda x: x and '더보기' in x)
    if more_link:
        return more_link.get('href')

    # 클래스명으로 찾기
    more_link = container.find('a', class_=lambda x: x and 'more' in str(x).lower())
    if more_link:
        return more_link.get('href')

    # title 속성으로 찾기
    more_link = container.find('a', title=lambda x: x and '더보기' in x)
    if more_link:
        return more_link.get('href')

    # aria-label로 찾기
    more_link = container.find('a', attrs={'aria-label': lambda x: x and '더보기' in x})
    if more_link:
        return more_link.get('href')

    # 방법 2: parent section에서 ugc_list footer 찾기
    parent_section = container.find_parent(['div', 'section'])
    if parent_section:
        # fds-comps-footer-full-container 찾기
        footer = parent_section.find('div', class_=lambda x: x and 'fds-comps-footer-full-container' in str(x))
        if footer:
            # fds-comps-more-button-no-border 찾기
            more_button = footer.find('div', class_=lambda x: x and 'fds-comps-more-button-no-border' in str(x))
            if more_button:
                link = more_button.find('a', href=True)
                if link:
                    href = link.get('href')
                    if href:  # lb_api URL도 포함
                        print(f'Found ugc_list more link in footer: {href[:80]}...', file=sys.stderr)
                        return href

    return None


def scrape_more_page(more_url: str, cookies: dict, headers: dict) -> List[Dict]:
    """더보기 페이지의 전체 블로그 목록 스크래핑"""

    try:
        response = requests.get(more_url, cookies=cookies, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'lxml')

        # extract_blogs_from_container 재사용
        return extract_blogs_from_container(soup, headers)

    except Exception as e:
        print(f"Error scraping more page {more_url}: {e}", file=sys.stderr)
        return []


def detect_smartblock_categories(html: str) -> List[Dict]:
    """스마트블록 카테고리 감지 및 정보 추출"""

    soup = BeautifulSoup(html, 'lxml')
    categories = []
    seen_containers = set()

    # 전략 0: fds-ugc-block-mod-list 직접 타겟팅 (최우선)
    ugc_list_containers = soup.find_all('div', class_=lambda x: x and 'fds-ugc-block-mod-list' in str(x))

    for container in ugc_list_containers:
        container_id = id(container)
        if container_id in seen_containers:
            continue
        seen_containers.add(container_id)

        # 제목 찾기
        title = "스마트블록"
        parent_section = container.find_parent(['div', 'section'], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ['fds-info-section', 'api-subject-bx', 'section']
        ))

        if parent_section:
            headline = parent_section.find(['span', 'h2', 'h3', 'strong'], class_=lambda x: x and any(
                keyword in str(x).lower() for keyword in ['headline', 'title', 'subject', 'header']
            ))
            if headline:
                title = headline.get_text(strip=True)

        if title == "스마트블록":
            prev_sibling = container.find_previous_sibling(['div', 'header'])
            if prev_sibling:
                headline = prev_sibling.find(['span', 'h2', 'h3', 'strong'])
                if headline:
                    title = headline.get_text(strip=True)

        categories.append({
            'title': title,
            'type': 'ugc_list',
            'container': container
        })

    # 전략 1: sds-comps 클래스 (리빙 인플루언서) - v10 FIX: 컨테이너 단위로 감지
    # 개별 headline이 아닌 전체 컨테이너를 찾아서 카테고리로 인식
    # 최상위 sds-comps 컨테이너만 찾기 (너무 많은 중첩 div 방지)
    influencer_containers = soup.find_all('div', class_='fds-ugc-influencer')
    for container in influencer_containers:
        container_id = id(container)
        if container_id in seen_containers:
            continue

        # 컨테이너 내부에 headline이 있는지 확인
        first_headline = container.find('span', class_='sds-comps-text-type-headline1')
        if not first_headline:
            continue

        # 카테고리 제목: 상위 섹션의 제목 또는 기본값
        title = "리빙 인플루언서 콘텐츠"
        parent_section = container.find_parent(['div', 'section'], class_=lambda x: x and any(
            keyword in str(x).lower() for keyword in ['fds-info-section', 'api-subject-bx', 'section']
        ))

        if parent_section:
            section_title = parent_section.find(['h2', 'h3', 'strong', 'span'], class_=lambda x: x and any(
                keyword in str(x).lower() for keyword in ['headline', 'title', 'subject']
            ))
            if section_title:
                title = section_title.get_text(strip=True)

        seen_containers.add(container_id)
        categories.append({
            'title': title,
            'type': 'influencer',
            'container': container
        })

    # 전략 2: fds-comps-footer-more-subject (지역 기반)
    location_blocks = soup.find_all('span', class_='fds-comps-footer-more-subject')
    for block in location_blocks:
        title = block.get_text(strip=True)
        container = block.find_parent('div', class_=lambda x: x and 'fds-comps' in str(x))
        if container:
            container_id = id(container)
            if container_id not in seen_containers:
                seen_containers.add(container_id)
                categories.append({
                    'title': title,
                    'type': 'location',
                    'container': container
                })

    # 전략 3: fds-comps-header-headline (일반 스마트블록)
    general_blocks = soup.find_all('span', class_='fds-comps-header-headline')
    for block in general_blocks:
        title = block.get_text(strip=True)
        container = block.find_parent('div', class_=lambda x: x and 'fds-comps' in str(x))
        if container:
            container_id = id(container)
            if container_id not in seen_containers:
                seen_containers.add(container_id)
                categories.append({
                    'title': title,
                    'type': 'general',
                    'container': container
                })

    # 전략 3.5: fds-ugc-block-root-ad-header (브랜드 콘텐츠 블록)
    brand_blocks = soup.find_all(class_=lambda x: x and 'fds-ugc-block-root-ad-header' in str(x))
    for block in brand_blocks:
        # 제목 추출
        title_span = block.find('span')
        if title_span:
            title = title_span.get_text(strip=True)
        else:
            title = '브랜드 콘텐츠'
        
        # 전체 컨테이너 찾기 (ID가 fdr-로 시작하는 부모)
        container = block.find_parent(id=lambda x: x and x.startswith('fdr-'))
        if container:
            container_id = id(container)
            if container_id not in seen_containers:
                seen_containers.add(container_id)
                categories.append({
                    'title': title,
                    'type': 'brand_content',
                    'container': container
                })

    # 전략 4: JSON 내 content 필드 (브랜드 콘텐츠)
    script_tags = soup.find_all('script', type='application/json')
    for script in script_tags:
        try:
            if not script.string:
                continue

            data = json.loads(script.string)

            def find_brand_content(obj, path=""):
                if isinstance(obj, dict):
                    for key, value in obj.items():
                        if key == 'content' and isinstance(value, str) and '브랜드 콘텐츠' in value:
                            return value
                        result = find_brand_content(value, f"{path}.{key}")
                        if result:
                            return result
                elif isinstance(obj, list):
                    for item in obj:
                        result = find_brand_content(item, path)
                        if result:
                            return result
                return None

            brand_content = find_brand_content(data)
            if brand_content:
                container = script.find_parent('div', class_=lambda x: x and any(
                    keyword in str(x).lower() for keyword in ['brand', 'ad', 'sponsor', 'comps']
                ))

                if not container:
                    container = script.find_parent('div')

                if container:
                    container_id = id(container)
                    if container_id not in seen_containers:
                        seen_containers.add(container_id)
                        categories.append({
                            'title': brand_content,
                            'type': 'brand',
                            'container': container
                        })
        except (json.JSONDecodeError, AttributeError):
            continue

    return categories


def main(keyword: str) -> dict:
    """메인 스크래핑 함수"""

    html = get_naver_search_html(keyword)

    if not html:
        return {
            'success': False,
            'error': 'Failed to fetch Naver search page'
        }

    categories_info = detect_smartblock_categories(html)
    result_categories = []
    total_blogs = 0

    cookies = {
        'NNB': 'ECHGGL2ZR7AGO',
        'ASID': '7425f1d60000019564d162b600000055',
        'PM_CK_loc': '1dd76e4b80bc46c7d0d1adf34d89f5e27fc787c39dbf2aab1c87ad65a4e7d39a',
        'SHP_BUCKET_ID': '4',
        'nx_ssl': '2',
        'page_uid': 'j9SIYdp0JXVssLpE5EZssssstJV-155875',
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'ko,en-US;q=0.9',
        'Referer': 'https://search.naver.com/',
    }

    for cat_info in categories_info:
        container = cat_info['container']
        blogs_preview = extract_blogs_from_container(container, headers)
        more_link = find_more_link(container)

        more_blogs = []
        if more_link:
            # Check if it's an lb_api URL (ugc_list category)
            if more_link.startswith('#lb_api='):
                # Phase 1: lb_api 직접 호출
                more_blogs = scrape_lb_api_more_page(more_link, cookies, headers)
                
                # Phase 2: lb_api가 실패하거나 블로그가 적을 때 Playwright fallback
                if len(more_blogs) < 5:
                    print(f'lb_api 결과 부족 ({len(more_blogs)}개), Playwright로 재시도 (headless=False)...', file=sys.stderr)
                    try:
                        playwright_blogs = scrape_ugc_list_with_playwright(
                            more_link, keyword, headers, headless=False, max_pages=2
                        )
                        
                        # Playwright 결과가 더 많으면 사용
                        if len(playwright_blogs) > len(more_blogs):
                            print(f'Playwright 결과가 더 우수: {len(playwright_blogs)}개 vs {len(more_blogs)}개', file=sys.stderr)
                            more_blogs = playwright_blogs
                    except Exception as e:
                        print(f'Playwright fallback 실패, 429 에러 시 headless=True로 재시도: {e}', file=sys.stderr)
                        if '429' in str(e) or 'Too Many Requests' in str(e):
                            try:
                                playwright_blogs = scrape_ugc_list_with_playwright(
                                    more_link, keyword, headers, headless=True, max_pages=2
                                )
                                if len(playwright_blogs) > len(more_blogs):
                                    more_blogs = playwright_blogs
                            except Exception as e2:
                                print(f'Playwright headless 모드도 실패: {e2}', file=sys.stderr)
            else:
                # Use regular scraper for influencer/other categories
                if more_link.startswith('/'):
                    full_more_url = f"https://search.naver.com{more_link}"
                elif more_link.startswith('http'):
                    full_more_url = more_link
                else:
                    full_more_url = f"https://search.naver.com/{more_link}"

                more_blogs = scrape_more_page(full_more_url, cookies, headers)

        category_data = {
            'categoryTitle': cat_info['title'],
            'categoryType': cat_info['type'],
            'blogsInPreview': blogs_preview,
            'moreLink': more_link,
            'morePageBlogs': more_blogs,
            'totalBlogsInMore': len(more_blogs)
        }

        result_categories.append(category_data)
        total_blogs += len(blogs_preview) + len(more_blogs)

    # v12: Filter empty and duplicate categories
    filtered_categories = []
    seen_titles = set()
    
    for cat in result_categories:
        total_blogs_in_cat = len(cat['blogsInPreview']) + cat['totalBlogsInMore']
        
        # Skip empty categories
        if total_blogs_in_cat == 0:
            continue
        
        # Skip duplicate titles
        if cat['categoryTitle'] in seen_titles:
            continue
        
        seen_titles.add(cat['categoryTitle'])
        filtered_categories.append(cat)
    
    # Replace with filtered categories and recalculate total
    result_categories = filtered_categories
    total_blogs = sum(len(cat['blogsInPreview']) + cat['totalBlogsInMore'] for cat in result_categories)
    
    return {
        'success': True,
        'keyword': keyword,
        'scrapedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'totalCategories': len(result_categories),
        'totalBlogs': total_blogs,
        'categories': result_categories
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python scrape_smartblocks.py <keyword>'
        }, ensure_ascii=False))
        sys.exit(1)

    keyword = sys.argv[1]

    try:
        result = main(keyword)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
