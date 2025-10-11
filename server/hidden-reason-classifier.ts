/**
 * Phase 2: 숨김 이유 분류 시스템
 * 
 * 기술적 원인을 사용자 친화적인 카테고리와 메시지로 변환합니다.
 */

export interface HiddenReasonClassification {
  category: string;           // 카테고리 (예: "품질_필터", "스팸_의심")
  detail: string;             // 사용자에게 보여줄 설명
  detectionMethod: string;    // 감지 방법
  recoveryEstimate: string;   // 예상 복구 시간
  severity: 'low' | 'medium' | 'high' | 'critical';  // 심각도
  actionGuide: string;        // 대응 방법
}

/**
 * 기술적 숨김 원인을 사용자 친화적인 분류로 변환
 */
export class HiddenReasonClassifier {
  
  /**
   * 숨김 원인 분류
   */
  classify(
    technicalReason: string,
    detectionMethod: string = 'css_check'
  ): HiddenReasonClassification {
    
    // CSS display:none 기반 숨김
    if (technicalReason === 'display_none') {
      return this.classifyDisplayNone();
    }
    
    // CSS visibility:hidden 기반 숨김
    if (technicalReason === 'visibility_hidden') {
      return this.classifyVisibilityHidden();
    }
    
    // CSS opacity:0 기반 숨김
    if (technicalReason === 'opacity_zero') {
      return this.classifyOpacityZero();
    }
    
    // CSS hidden 클래스
    if (technicalReason === 'css_class_hidden') {
      return this.classifyCssClassHidden();
    }
    
    // 기본 분류 (알 수 없는 원인)
    return this.classifyUnknown(technicalReason);
  }
  
  /**
   * display:none 숨김 분류
   * → 보통 네이버 품질 필터 또는 정책 위반
   */
  private classifyDisplayNone(): HiddenReasonClassification {
    return {
      category: '품질 필터',
      detail: '네이버 품질 관리 시스템에 의해 일시적으로 노출이 제한되었습니다. 최근 유사한 콘텐츠가 많거나, 품질 점검이 진행 중일 수 있습니다.',
      detectionMethod: 'css_display_check',
      recoveryEstimate: '24-48시간',
      severity: 'high',
      actionGuide: '1) 24-48시간 대기 후 자동 복구 여부 확인\n2) 콘텐츠 고유성 및 품질 개선\n3) 과도한 재발행 자제'
    };
  }
  
  /**
   * visibility:hidden 숨김 분류
   * → 보통 일시적 검토 또는 A/B 테스트
   */
  private classifyVisibilityHidden(): HiddenReasonClassification {
    return {
      category: '일시적 검토',
      detail: '네이버에서 일시적으로 검토 중입니다. 요소는 존재하지만 시각적으로 숨겨진 상태입니다.',
      detectionMethod: 'css_visibility_check',
      recoveryEstimate: '12-24시간',
      severity: 'medium',
      actionGuide: '1) 12-24시간 후 자동 복구 예상\n2) 별도 조치 불필요\n3) 복구되지 않으면 콘텐츠 품질 점검'
    };
  }
  
  /**
   * opacity:0 숨김 분류
   * → 보통 UI 전환 효과 또는 스팸 의심
   */
  private classifyOpacityZero(): HiddenReasonClassification {
    return {
      category: '스팸 의심',
      detail: '스팸 또는 저품질 콘텐츠로 의심되어 투명도 처리되었습니다. 네이버의 자동 필터링 시스템이 작동한 것으로 보입니다.',
      detectionMethod: 'css_opacity_check',
      recoveryEstimate: '48-72시간',
      severity: 'high',
      actionGuide: '1) 48-72시간 대기\n2) 블로그 전체 품질 점검 필요\n3) 스팸성 키워드, 링크 제거\n4) 원본 콘텐츠 비율 높이기'
    };
  }
  
  /**
   * CSS hidden 클래스 숨김
   * → 보통 광고 우선 노출 또는 시간대별 제한
   */
  private classifyCssClassHidden(): HiddenReasonClassification {
    return {
      category: '정책 위반',
      detail: '광고 또는 프로모션 콘텐츠가 우선 노출되어 일시적으로 가려졌습니다. 특정 시간대에만 발생할 수 있습니다.',
      detectionMethod: 'css_class_check',
      recoveryEstimate: '1-6시간',
      severity: 'low',
      actionGuide: '1) 다른 시간대에 재측정\n2) 오전 또는 심야 시간대 확인\n3) 광고 경쟁 키워드인지 검토'
    };
  }
  
  /**
   * 알 수 없는 원인
   */
  private classifyUnknown(technicalReason: string): HiddenReasonClassification {
    return {
      category: '알 수 없음',
      detail: `알 수 없는 이유로 숨겨졌습니다 (감지된 원인: ${technicalReason}). 추가 분석이 필요합니다.`,
      detectionMethod: 'unknown',
      recoveryEstimate: '알 수 없음',
      severity: 'medium',
      actionGuide: '1) 6-12시간 후 재측정\n2) 패턴 반복 시 고객센터 문의\n3) 키워드 및 URL 재검토'
    };
  }
  
  /**
   * 카테고리를 사용자 친화적인 이름으로 변환
   */
  getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      '품질_필터': '🔍 품질 필터',
      '일시적_검토': '⏳ 일시적 검토',
      '스팸_의심': '⚠️ 스팸 의심',
      '광고_우선노출': '📢 광고 우선 노출',
      '알_수_없음': '❓ 알 수 없음'
    };
    return displayNames[category] || category;
  }
  
  /**
   * 심각도에 따른 색상 반환
   */
  getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    const colors = {
      low: 'blue',
      medium: 'yellow',
      high: 'orange',
      critical: 'red'
    };
    return colors[severity];
  }
}

// 싱글톤 인스턴스
export const hiddenReasonClassifier = new HiddenReasonClassifier();
